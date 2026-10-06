import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../src/lib/prisma';
import { issueSessionToken } from '../src/lib/session';
import { appointHelper, provisionVerifiedAdmin } from '../src/lib/admin';
import { assertTransactionRole, requireUser, type Member } from '../src/lib/auth';
import { inviteAdmin, invitationDigest } from '../src/lib/admin-invite';
import { publishingDay, reserveDailyQuota, memberQuotas } from '../src/lib/quotas';
import { GET as notices, POST as publishNotice } from '../src/app/api/notice-board/route';
import { POST as noticeReply } from '../src/app/api/notice-board/[id]/replies/route';
import { GET as help, POST as publishHelp } from '../src/app/api/help-requests/route';
import { GET as detail } from '../src/app/api/help-requests/[id]/route';
import { GET as helpReplies, POST as helpReply } from '../src/app/api/help-requests/[id]/replies/route';
import { GET as users } from '../src/app/api/admin/users/route';
import { PATCH as assignment } from '../src/app/api/admin/users/[id]/helper/route';
import { GET as audit } from '../src/app/api/admin/audit/route';
import { POST as acceptInvite } from '../src/app/api/admin/invitations/accept/route';
import { POST as login } from '../src/app/api/auth/login/route';
import { GET as quotas } from '../src/app/api/me/quotas/route';
import { GET as dashboard } from '../src/app/api/dashboard/route';

const directory = mkdtempSync(join(tmpdir(), 'bachaoo-members-'));
const origin = 'http://localhost:3000';
const password = 'private-help-test-password';
const publication = { title: 'A useful campus update', content: 'Details for the college community.', category: 'Campus life' };
let invitationToken = '';
let mailFailure = false;
let admin: Member, owner: Member, peer: Member, helper: Member;
let tokens: Record<string, string>;

function request(path: string, token = '', body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return new Request(`${origin}${path}`, { method,
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Cookie: `auth-token=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function context(id: string) { return { params: Promise.resolve({ id }) }; }
function change(id: string, enabled: boolean, expectedRole?: string, token = tokens.admin) {
  return assignment(request(`/api/admin/users/${id}/helper`, token, { enabled, expectedRole }, 'PATCH'), context(id));
}

before(() => {
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `file:${join(directory, 'test.db')}`,
    JWT_SECRET: 'isolated-member-tests-not-a-real-secret-123456789', BREVO_API_KEY: 'mock-only', BREVO_SENDER_EMAIL: 'sender@example.invalid' });
  for (const key of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VERCEL', 'VERCEL_ENV', 'AUTH_LOCAL_TESTING']) delete process.env[key];
  const db = new Database(join(directory, 'test.db'));
  for (const name of readdirSync('prisma/migrations').filter(name => /^\d/.test(name)).sort()) db.exec(readFileSync(join('prisma/migrations', name, 'migration.sql'), 'utf8'));
  db.close();
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.brevo.com/v3/smtp/email', 'No real network access');
    const payload = JSON.parse(String(init?.body));
    invitationToken = /#invite=([a-f0-9]{64})/.exec(payload.textContent)?.[1] || '';
    assert.ok(invitationToken, 'Invitation delivered through the mocked email boundary');
    return new Response('{}', { status: mailFailure ? 500 : 201 });
  });
});

beforeEach(async () => {
  const db = getPrisma();
  await db.roleAudit.deleteMany(); await db.helpReply.deleteMany(); await db.helpRequest.deleteMany();
  await db.reply.deleteMany(); await db.post.deleteMany(); await db.user.deleteMany();
  await db.adminInvite.deleteMany(); await db.rateLimit.deleteMany(); await db.otp.deleteMany();
  invitationToken = ''; mailFailure = false;
  const hash = await bcrypt.hash(password, 4);
  const rows = await db.user.createManyAndReturn({ data: [
    { name: 'Admin Fixture', email: 'admin@example.invalid', role: 'ADMIN', password: hash, emailVerifiedAt: new Date() },
    ...['Owner', 'Peer', 'Helper'].map((name, i) => ({ name, email: `12345678900${i}@cutm.ac.in`, role: 'POSTER', password: hash, studyYear: 3, emailVerifiedAt: new Date() })),
  ] });
  tokens = {};
  for (const [i, name] of ['admin', 'owner', 'peer', 'helper'].entries()) {
    const row = rows.find(row => row.name === (i ? ['Owner', 'Peer', 'Helper'][i - 1] : 'Admin Fixture'))!;
    tokens[name] = await issueSessionToken({ id: row.id, role: 'POSTER' }); // Deliberately stale role claims.
  }
  admin = await requireUser(request('/api/me', tokens.admin));
  owner = await requireUser(request('/api/me', tokens.owner));
  peer = await requireUser(request('/api/me', tokens.peer));
  await appointHelper(admin, rows.find(row => row.name === 'Helper')!.id, true);
  helper = await requireUser(request('/api/me', tokens.helper));
  await db.roleAudit.deleteMany();
});

after(async () => { await getPrisma().$disconnect(); mock.restoreAll(); rmSync(directory, { recursive: true, force: true }); });

test('role matrix separates notices from private help and never exposes another Poster’s thread', async () => {
  const notice = await publishNotice(request('/api/notice-board', tokens.owner, publication));
  assert.equal(notice.status, 201);
  const noticeId = (await notice.json()).post.id;
  const saved = await publishHelp(request('/api/help-requests', tokens.owner, { ...publication, title: 'Private-only support request', authorId: peer.id, collegeId: 'other' }));
  assert.equal(saved.status, 201);
  const thread = (await saved.json()).request;
  assert.equal(thread.author.id, owner.id);
  for (const token of [tokens.owner, tokens.peer, tokens.helper, tokens.admin]) {
    assert.equal((await notices(request('/api/notice-board', token))).status, 200);
    assert.equal((await noticeReply(request(`/api/notice-board/${noticeId}/replies`, token, { content: 'A useful notice reply.' }), context(noticeId))).status, 201);
  }
  for (const token of [tokens.helper, tokens.admin]) {
    assert.equal((await publishNotice(request('/api/notice-board', token, publication))).status, 403);
    assert.equal((await publishHelp(request('/api/help-requests', token, publication))).status, 403);
  }
  assert.equal((await help(request('/api/help-requests'))).status, 401);
  assert.equal((await help(request('/api/help-requests', tokens.admin))).status, 403);
  for (const reader of [tokens.owner, tokens.helper]) assert.equal((await detail(request(`/api/help-requests/${thread.id}`, reader), context(thread.id))).status, 200);
  for (const reader of [tokens.peer, tokens.admin]) {
    const status = reader === tokens.peer ? 404 : 403;
    assert.equal((await detail(request(`/api/help-requests/${thread.id}`, reader), context(thread.id))).status, status);
    assert.equal((await helpReplies(request(`/api/help-requests/${thread.id}/replies`, reader), context(thread.id))).status, status);
  }
  assert.deepEqual((await (await help(request('/api/help-requests?q=Private&authorId=spoof', tokens.peer))).json()).requests, []);
  for (const reader of [tokens.owner, tokens.peer, tokens.admin]) assert.equal((await helpReply(request(`/api/help-requests/${thread.id}/replies`, reader, { content: 'Forbidden reply' }), context(thread.id))).status, 403);
  assert.equal((await helpReply(request(`/api/help-requests/${thread.id}/replies`, tokens.helper, { content: 'Private Helper response.' }), context(thread.id))).status, 201);
  const response = await helpReplies(request(`/api/help-requests/${thread.id}/replies`, tokens.owner), context(thread.id));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).replies[0].content, 'Private Helper response.');
  for (const path of ['/api/notice-board', '/api/notice-board?q=Private']) {
    const data = JSON.stringify(await (await notices(request(path, tokens.helper))).json());
    for (const secret of [thread.id, 'Private-only support request', 'Private Helper response.', '@cutm.ac.in', 'password']) assert.equal(data.includes(secret), false);
  }
  const foreign = await getPrisma().helpRequest.create({ data: { ...publication, collegeId: 'other', authorId: owner.id } });
  assert.equal((await detail(request(`/api/help-requests/${foreign.id}`, tokens.helper), context(foreign.id))).status, 404);
  assert.equal((await helpReply(request(`/api/help-requests/${foreign.id}/replies`, tokens.helper, { content: 'No foreign reply' }), context(foreign.id))).status, 404);
  assert.equal((await noticeReply(request(`/api/notice-board/${thread.id}/replies`, tokens.helper, { content: 'No help in notice API' }), context(thread.id))).status, 404);
});

test('only Admins appoint verified own-college members, with conflict checks and immediate stale-session revocation', async () => {
  for (const token of ['', tokens.owner, tokens.helper]) {
    assert.equal((await users(request('/api/admin/users', token))).status, token ? 403 : 401);
    assert.equal((await change(peer.id, true, undefined, token)).status, token ? 403 : 401);
    assert.equal((await audit(request('/api/admin/audit', token))).status, token ? 403 : 401);
  }
  const unverified = await getPrisma().user.create({ data: { name: 'Unverified', email: '123456789099@cutm.ac.in', password: 'unused' } });
  const foreign = await getPrisma().user.create({ data: { name: 'Foreign', email: 'foreign@example.invalid', password: 'unused', collegeId: 'other', emailVerifiedAt: new Date() } });
  assert.equal((await change(unverified.id, true)).status, 403);
  assert.equal((await change(foreign.id, true)).status, 404);
  assert.equal((await change(admin.id, true)).status, 403);
  const list = await (await users(request('/api/admin/users?collegeId=other', tokens.admin))).json();
  assert.ok(list.users.every((user: { collegeId: string }) => user.collegeId === 'centurion'));
  assert.equal(list.users.some((user: { id: string }) => [unverified.id, foreign.id, admin.id].includes(user.id)), false);
  assert.equal(JSON.stringify(list).includes('password'), false);
  assert.equal((await change(peer.id, true, 'POSTER')).status, 200);
  assert.equal((await change(peer.id, false, 'POSTER')).status, 409);
  assert.equal((await (await change(peer.id, true, 'HELPER')).json()).changed, false);
  const thread = await getPrisma().helpRequest.create({ data: { ...publication, authorId: owner.id, collegeId: 'centurion' } });
  assert.equal((await detail(request(`/api/help-requests/${thread.id}`, tokens.peer), context(thread.id))).status, 200);
  assert.equal((await change(peer.id, false, 'HELPER')).status, 200);
  assert.equal((await detail(request(`/api/help-requests/${thread.id}`, tokens.peer), context(thread.id))).status, 404);
  assert.equal((await helpReply(request(`/api/help-requests/${thread.id}/replies`, tokens.peer, { content: 'Stale permission attempt' }), context(thread.id))).status, 403);
  assert.equal((await (await dashboard(request('/api/dashboard', tokens.peer))).json()).role, 'POSTER');
  assert.deepEqual((await getPrisma().roleAudit.findMany({ orderBy: { createdAt: 'asc' } })).map(row => [row.actorId, row.targetId, row.oldRole, row.newRole]), [[admin.id, peer.id, 'POSTER', 'HELPER'], [admin.id, peer.id, 'HELPER', 'POSTER']]);
  await getPrisma().user.update({ where: { id: admin.id }, data: { role: 'POSTER' } });
  await assert.rejects(appointHelper(admin, peer.id, true), /permission|membership/);
  await assert.rejects(getPrisma().$transaction(tx => assertTransactionRole(tx, helper, ['POSTER'])), /permission/);
});

test('appointment and audit roll back together if writing the audit fails', async () => {
  const db = getPrisma();
  await db.$executeRawUnsafe('CREATE TRIGGER fail_role_audit BEFORE INSERT ON RoleAudit BEGIN SELECT RAISE(ABORT, \'fixture failure\'); END');
  try {
    assert.equal((await change(peer.id, true)).status, 503);
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: peer.id } });
    assert.equal(unchanged.role, 'POSTER'); assert.equal(unchanged.helperAssignedAt, null);
    assert.equal(await db.roleAudit.count(), 0);
  } finally { await db.$executeRawUnsafe('DROP TRIGGER fail_role_audit'); }
});

test('independent publication quotas persist across sessions/deletion with accurate retry headers', async () => {
  assert.equal((await publishHelp(request('/api/help-requests', tokens.owner, { ...publication, title: 'x' }))).status, 400);
  assert.equal(await getPrisma().dailyQuota.count(), 0);
  assert.equal((await publishHelp(request('/api/help-requests', tokens.owner, publication))).status, 201);
  let allowance = (await (await quotas(request('/api/me/quotas', tokens.owner))).json()).quotas;
  assert.equal(allowance.notice.remaining, 1); assert.equal(allowance.help.remaining, 0);
  assert.equal((await publishNotice(request('/api/notice-board', tokens.owner, publication))).status, 201);
  const fresh = await issueSessionToken({ id: owner.id, role: 'POSTER' });
  allowance = (await (await quotas(request('/api/me/quotas', fresh))).json()).quotas;
  assert.equal(allowance.timezone, 'Asia/Kolkata');
  assert.equal(allowance.notice.remaining, 0); assert.equal(allowance.help.remaining, 0);
  await getPrisma().post.deleteMany(); await getPrisma().helpRequest.deleteMany();
  for (const [path, handler] of [['/api/notice-board', publishNotice], ['/api/help-requests', publishHelp]] as const) {
    const result = await handler(request(path, fresh, publication));
    assert.equal(result.status, 429);
    const seconds = Number(result.headers.get('retry-after'));
    assert.ok(seconds > 0 && Math.abs(seconds - Math.ceil((Date.parse(allowance.resetAt) - Date.now()) / 1000)) <= 2);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal(await getPrisma().dailyQuota.count(), 2);
});

test('simultaneous duplicate publications save exactly one notice and one independent help request', async () => {
  for (const [path, handler] of [['/api/notice-board', publishNotice], ['/api/help-requests', publishHelp]] as const) {
    const responses = await Promise.all(Array.from({ length: 4 }, () => handler(request(path, tokens.owner, publication))));
    assert.deepEqual(responses.map(response => response.status).sort(), [201, 429, 429, 429]);
  }
  assert.equal(await getPrisma().post.count(), 1); assert.equal(await getPrisma().helpRequest.count(), 1);
  assert.equal(await getPrisma().dailyQuota.count(), 2);
});

test('failed content writes roll back the reserved allowance for both publication forms', async () => {
  const db = getPrisma();
  for (const [table, path, handler] of [['Post', '/api/notice-board', publishNotice], ['HelpRequest', '/api/help-requests', publishHelp]] as const) {
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_publication BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
    try { assert.equal((await handler(request(path, tokens.owner, publication))).status, 503); assert.equal(await db.dailyQuota.count(), 0); }
    finally { await db.$executeRawUnsafe('DROP TRIGGER fail_publication'); }
  }
  assert.equal((await publishNotice(request('/api/notice-board', tokens.owner, publication))).status, 201);
  assert.equal((await publishHelp(request('/api/help-requests', tokens.owner, publication))).status, 201);
});

test('quotas reset at midnight IST, including leap-day rollover, without restoring the earlier day', async () => {
  const before = new Date('2028-02-29T18:29:59.999Z'), after = new Date('2028-02-29T18:30:00.000Z');
  assert.equal(publishingDay(before).day, '2028-02-29'); assert.equal(publishingDay(before).resetAt.toISOString(), after.toISOString());
  assert.equal(publishingDay(after).day, '2028-03-01'); assert.equal(publishingDay(after).resetAt.toISOString(), '2028-03-01T18:30:00.000Z');
  const db = getPrisma();
  await db.$transaction(tx => reserveDailyQuota(tx, owner, 'NOTICE_BOARD', before));
  await assert.rejects(db.$transaction(tx => reserveDailyQuota(tx, owner, 'NOTICE_BOARD', before)), error => {
    assert.ok(error instanceof Error && 'retryAfter' in error); assert.equal(error.retryAfter, 1); return true;
  });
  assert.equal((await memberQuotas(owner, after)).notice.remaining, 1);
  await db.$transaction(tx => reserveDailyQuota(tx, owner, 'NOTICE_BOARD', after));
  assert.equal((await memberQuotas(owner, after)).notice.remaining, 0);
  assert.equal(await db.dailyQuota.count(), 2);
});

test('private-help lists and replies paginate tied timestamps without exposing foreign/unowned cursors', async () => {
  const db = getPrisma(), stamp = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < 23; i++) await db.helpRequest.create({ data: { ...publication, title: `Private page ${i}`, authorId: owner.id, collegeId: 'centurion', createdAt: stamp } });
  const hidden = await db.helpRequest.create({ data: { ...publication, authorId: peer.id, collegeId: 'centurion' } });
  const expected = (await db.helpRequest.findMany({ where: { authorId: owner.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(row => row.id);
  const first = await (await help(request('/api/help-requests', tokens.owner))).json();
  const second = await (await help(request(`/api/help-requests?before=${first.nextCursor}`, tokens.owner))).json();
  assert.equal(first.requests.length, 20); assert.equal(second.nextCursor, null);
  assert.deepEqual([...first.requests, ...second.requests].map(row => row.id), expected);
  assert.equal((await help(request(`/api/help-requests?before=${hidden.id}`, tokens.owner))).status, 400);
  for (let i = 0; i < 25; i++) await db.helpReply.create({ data: { content: `Helper page ${i}`, authorId: helper.id, requestId: expected[0], collegeId: 'centurion', createdAt: stamp } });
  const foreignReply = await db.helpReply.create({ data: { content: 'Hidden cursor', authorId: helper.id, requestId: hidden.id, collegeId: 'centurion' } });
  const expectedReplies = (await db.helpReply.findMany({ where: { requestId: expected[0] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(row => row.id);
  const replyFirst = await (await helpReplies(request(`/api/help-requests/${expected[0]}/replies`, tokens.owner), context(expected[0]))).json();
  const replySecond = await (await helpReplies(request(`/api/help-requests/${expected[0]}/replies?before=${replyFirst.nextCursor}`, tokens.owner), context(expected[0]))).json();
  assert.deepEqual([...replyFirst.replies, ...replySecond.replies].map(row => row.id), expectedReplies);
  assert.equal((await helpReplies(request(`/api/help-requests/${expected[0]}/replies?before=${foreignReply.id}`, tokens.owner), context(expected[0]))).status, 400);
  assert.equal((await help(request(`/api/help-requests?before=${expected[0]}`, tokens.peer))).status, 400);
  assert.equal((await help(request(`/api/help-requests?q=${'x'.repeat(161)}`, tokens.helper))).status, 400);
});

test('operator email invitation creates a verified external Admin once, independent of public onboarding', async () => {
  await inviteAdmin('Invited.Admin@example.invalid', 'centurion', 'https://fixture.example.invalid');
  const token = invitationToken;
  const invitation = await getPrisma().adminInvite.findUniqueOrThrow({ where: { email: 'invited.admin@example.invalid' } });
  assert.equal(invitation.digest, invitationDigest(token)); assert.notEqual(invitation.digest, token); assert.equal(invitation.delivered, true);
  process.env.REGISTRATION_OPEN = 'false';
  try {
    const results = await Promise.all(Array.from({ length: 2 }, () => acceptInvite(request('/api/admin/invitations/accept', '', { token, name: 'Invited Admin', password }))));
    assert.equal(results.filter(result => result.status === 200).length, 1);
    const accepted = results.find(result => result.status === 200)!;
    assert.deepEqual(await accepted.json(), { redirectTo: '/superadmin' });
    assert.match(accepted.headers.get('set-cookie') || '', /HttpOnly/);
    assert.equal(await getPrisma().adminInvite.count(), 0);
    assert.equal(await getPrisma().roleAudit.count({ where: { action: 'ADMIN_INVITE_ACCEPTED' } }), 1);
    const account = await getPrisma().user.findUniqueOrThrow({ where: { email: invitation.email } });
    assert.equal(account.role, 'ADMIN'); assert.ok(account.emailVerifiedAt); assert.ok(await bcrypt.compare(password, account.password));
    assert.equal((await acceptInvite(request('/api/admin/invitations/accept', '', { token, name: 'Replay Admin', password }))).status, 400);
    const signedIn = await login(request('/api/auth/login', '', { email: invitation.email.toUpperCase(), password }));
    assert.deepEqual(await signedIn.json(), { redirectTo: '/superadmin' });
    const session = /auth-token=([^;]+)/.exec(signedIn.headers.get('set-cookie') || '')![1];
    assert.equal((await users(request('/api/admin/users', session))).status, 200);
    assert.equal((await help(request('/api/help-requests', session))).status, 403);
  } finally { delete process.env.REGISTRATION_OPEN; }
});

test('expired, undelivered, replaced and cross-origin invitations cannot activate an account', async () => {
  const email = 'invited.admin@example.invalid';
  await inviteAdmin(email, 'centurion', 'https://fixture.example.invalid');
  const old = invitationToken;
  await inviteAdmin(email, 'centurion', 'https://fixture.example.invalid');
  const token = invitationToken;
  assert.notEqual(token, old);
  const body = { token, name: 'Invited Admin', password };
  assert.equal((await acceptInvite(request('/api/admin/invitations/accept', '', { ...body, token: old }))).status, 400);
  const foreign = request('/api/admin/invitations/accept', '', body); foreign.headers.set('Origin', 'https://attacker.invalid');
  assert.equal((await acceptInvite(foreign)).status, 403);
  assert.equal((await acceptInvite(request('/api/admin/invitations/accept', '', { ...body, password: 'short' }))).status, 400);
  await getPrisma().adminInvite.update({ where: { email }, data: { delivered: false } });
  assert.equal((await acceptInvite(request('/api/admin/invitations/accept', '', body))).status, 400);
  await getPrisma().adminInvite.update({ where: { email }, data: { delivered: true, expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await acceptInvite(request('/api/admin/invitations/accept', '', body))).status, 400);
  assert.equal(await getPrisma().user.count({ where: { email } }), 0);
});

test('failed invitation email leaves no usable invitation and operator refuses existing accounts/invalid origins', async () => {
  const logger = mock.method(console, 'error', () => {});
  mailFailure = true;
  try {
    await assert.rejects(inviteAdmin('invited.admin@example.invalid', 'centurion', 'https://fixture.example.invalid'), /email/i);
    assert.equal(await getPrisma().adminInvite.count(), 0);
    await assert.rejects(inviteAdmin('admin@example.invalid', 'centurion', 'https://fixture.example.invalid'), /already/);
    for (const invalid of ['http://localhost:3000', 'https://fixture.example.invalid/path', 'https://fixture.example.invalid/?query=1']) await assert.rejects(inviteAdmin('new@example.invalid', 'centurion', invalid), /origin/);
  } finally { logger.mock.restore(); }
});

test('missing session configuration does not consume an Admin invitation or create an account', async () => {
  await inviteAdmin('invited.admin@example.invalid', 'centurion', 'https://fixture.example.invalid');
  const secret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.equal((await acceptInvite(request('/api/admin/invitations/accept', '', { token: invitationToken, name: 'Invited Admin', password }))).status, 503);
    assert.equal(await getPrisma().adminInvite.count(), 1);
    assert.equal(await getPrisma().user.count({ where: { email: 'invited.admin@example.invalid' } }), 0);
  } finally { process.env.JWT_SECRET = secret; }
});

test('operator provisioning promotes only verified membership, preserves passwords, and is idempotent', async () => {
  const db = getPrisma();
  const account = await db.user.findUniqueOrThrow({ where: { id: peer.id } });
  assert.equal(await provisionVerifiedAdmin(account.email, account.collegeId), true);
  assert.equal(await provisionVerifiedAdmin(account.email, account.collegeId), false);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: peer.id } })).password, account.password);
  assert.equal(await db.roleAudit.count({ where: { action: 'OPERATOR_ADMIN_PROVISION' } }), 1);
  assert.equal((await help(request('/api/help-requests', tokens.peer))).status, 403);
  await db.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: null } });
  await assert.rejects(provisionVerifiedAdmin('123456789000@cutm.ac.in', 'centurion'), /verified/);
  await assert.rejects(provisionVerifiedAdmin(account.email, 'other'), /verified/);
});
