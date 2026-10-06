import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { collegeEmail } from '../src/lib/colleges';
import { databaseConfig } from '../src/lib/database-config';
import { getPrisma } from '../src/lib/prisma';
import { issueSessionToken, signingKey, verifySessionToken } from '../src/lib/session';
import { otpDigest } from '../src/lib/otp';
import { consumeRateLimit, rateKey, requestIdentity } from '../src/lib/rate-limit';
import { passwordInput as browserPasswordInput } from '../src/lib/password-validation';
import { passwordInput as verificationPasswordInput } from '../src/lib/http';
import { POST as register } from '../src/app/api/auth/register/route';
import { POST as verify } from '../src/app/api/auth/verify/route';
import { POST as login } from '../src/app/api/auth/login/route';
import { POST as logout } from '../src/app/api/auth/logout/route';
import { GET as me } from '../src/app/api/me/route';
import { GET as dashboard } from '../src/app/api/dashboard/route';
import { GET as feed, POST as ask } from '../src/app/api/posts/route';
import { POST as reply } from '../src/app/api/posts/[id]/replies/route';
import { proxy } from '../src/proxy';
import { appointHelper } from '../src/lib/admin';
import { requireUser } from '../src/lib/auth';
import { POST as helpReply } from '../src/app/api/help-requests/[id]/replies/route';

const origin = 'http://localhost:3000';
const email = '123456789012@cutm.ac.in';
const password = 'strong-test-password';
const temp = mkdtempSync(join(tmpdir(), 'bachaoo-backend-'));
const migrations = readdirSync('prisma/migrations').filter((name) => /^\d/.test(name)).sort()
  .map((name) => readFileSync(join('prisma/migrations', name, 'migration.sql'), 'utf8'));
let capturedOtp = '';
let mailFailure = false;
let mailFailureStatus = 503;
let mailFailureMessage = '';
let sentMessages = 0;

function request(path: string, body?: unknown, token?: string) {
  return new Request(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Cookie: `auth-token=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function registrationBody(code = capturedOtp) {
  return { email, otp: code, fullName: 'Test Student', password, studyYear: 4 };
}

async function member(suffix = '012', collegeId = 'centurion') {
  const user = await getPrisma().user.create({
    data: { email: `123456789${suffix}@cutm.ac.in`, name: `Student ${suffix}`, password: await bcrypt.hash(password, 4), role: 'POSTER', studyYear: 2, collegeId, emailVerifiedAt: new Date() },
  });
  return { user, token: await issueSessionToken({ id: user.id, role: 'POSTER' }) };
}

async function challenge(overrides: { expiresAt?: Date; attempts?: number; delivered?: boolean } = {}) {
  const id = 'a53f7a25-a9c8-4416-a6bc-418fc0729f52';
  await getPrisma().otp.create({ data: { id, email, digest: otpDigest(id, email, '123456'), expiresAt: new Date(Date.now() + 600_000), delivered: true, ...overrides } });
}

before(() => {
  // Tests never load .env, open dev.db, or send email. All credentials below are fixtures.
  Object.assign(process.env, {
    NODE_ENV: 'test', DATABASE_URL: `file:${join(temp, 'test.db')}`,
    REGISTRATION_OPEN: 'true',
    JWT_SECRET: 'isolated-tests-only-not-a-real-secret-123456789',
    BREVO_API_KEY: 'test-mail-boundary', BREVO_SENDER_EMAIL: 'test@example.invalid',
  });
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.AUTH_LOCAL_TESTING;
  const db = new Database(join(temp, 'test.db'));
  for (const migration of migrations) db.exec(migration);
  db.close();
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.brevo.com/v3/smtp/email', 'No real or unexpected network requests');
    sentMessages++;
    const payload = JSON.parse(String(init?.body));
    capturedOtp = /code is (\d{6})/.exec(payload.textContent)?.[1] ?? '';
    assert.match(capturedOtp, /^\d{6}$/);
    return new Response(mailFailure ? JSON.stringify({ message: mailFailureMessage }) : '{}', { status: mailFailure ? mailFailureStatus : 201 });
  });
});

beforeEach(async () => {
  capturedOtp = '';
  mailFailure = false;
  mailFailureStatus = 503;
  mailFailureMessage = '';
  sentMessages = 0;
  const db = getPrisma();
  await db.roleAudit.deleteMany();
  await db.helpReply.deleteMany();
  await db.helpRequest.deleteMany();
  await db.reply.deleteMany();
  await db.post.deleteMany();
  await db.user.deleteMany();
  await db.otp.deleteMany();
  await db.rateLimit.deleteMany();
});

after(async () => {
  await getPrisma().$disconnect();
  mock.restoreAll();
  rmSync(temp, { recursive: true, force: true });
});

test('college registry normalizes both approved domains and rejects lookalikes/types', () => {
  assert.deepEqual(collegeEmail(' 123456789012@CUTM.AC.IN '), { email, collegeId: 'centurion' });
  assert.equal(collegeEmail('123456789012@centurionuniv.edu.in').collegeId, 'centurion');
  for (const value of [null, 123, {}, 'abc@cutm.ac.in', '12345678901@cutm.ac.in', '123456789012@cutm.ac.in.evil.test', '123456789012@other.edu', '123456789012@@cutm.ac.in']) {
    assert.throws(() => collegeEmail(value));
  }
});

test('database configuration fails closed and permits only configured local/remote adapters', () => {
  assert.throws(() => databaseConfig({}), /unavailable/);
  assert.deepEqual(databaseConfig({ DATABASE_URL: 'file:./example.db' }), { kind: 'sqlite', url: 'file:./example.db' });
  assert.throws(() => databaseConfig({ DATABASE_URL: 'file:./example.db', VERCEL: '1' }), /unavailable/);
  assert.throws(() => databaseConfig({ DATABASE_URL: 'libsql://example.turso.io' }), /unavailable/);
  assert.throws(() => databaseConfig({ DATABASE_URL: 'http://example.test', TURSO_AUTH_TOKEN: 'fixture' }), /unavailable/);
  assert.equal(databaseConfig({ TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'fixture' }).kind, 'libsql');
});

test('migration preserves legacy accounts/posts and invalidates insecure outstanding codes only', () => {
  const db = new Database(':memory:');
  db.exec(migrations[0]);
  db.exec(`INSERT INTO User (id, email, name, password) VALUES ('legacy', 'legacy@example.invalid', 'Legacy', 'hash');
    INSERT INTO Post (id, title, content, authorId) VALUES ('post', 'Old question', 'Old content', 'legacy');
    INSERT INTO Otp (id, email, otp, expiresAt) VALUES ('code', 'legacy@example.invalid', '123456', '2099-01-01');`);
  for (const migration of migrations.slice(1)) db.exec(migration);
  assert.deepEqual(db.prepare('SELECT name, collegeId, studyYear FROM User').get(), { name: 'Legacy', collegeId: 'centurion', studyYear: null });
  assert.deepEqual(db.prepare('SELECT title, category, collegeId FROM Post').get(), { title: 'Old question', category: 'Academics', collegeId: 'centurion' });
  assert.equal((db.prepare('SELECT count(*) AS count FROM Otp').get() as { count: number }).count, 0);
  assert.equal((db.prepare('SELECT emailVerifiedAt FROM User').get() as { emailVerifiedAt: unknown }).emailVerifiedAt, null);
  assert.equal((db.prepare('SELECT count(*) AS count FROM HelpRequest').get() as { count: number }).count, 0);
  db.close();
});

test('new migration preserves OTP-era content, backfills verification, and revokes self-declared Helpers', () => {
  const db = new Database(':memory:');
  for (const migration of migrations.slice(0, 2)) db.exec(migration);
  db.exec(`INSERT INTO User (id, email, name, password, role, studyYear) VALUES ('modern', '123456789099@cutm.ac.in', 'Modern', 'hash', 'HELPER', 4);
    INSERT INTO Post (id, title, content, authorId) VALUES ('modern-post', 'Existing notice', 'Preserve this college content', 'modern');
    INSERT INTO Reply (id, content, postId, authorId, collegeId) VALUES ('modern-reply', 'Existing response', 'modern-post', 'modern', 'centurion');`);
  db.exec(migrations[2]);
  const account = db.prepare('SELECT role, emailVerifiedAt, helperAssignedAt, helperAssignedById FROM User').get() as Record<string, unknown>;
  assert.equal(account.role, 'POSTER'); assert.ok(account.emailVerifiedAt);
  assert.equal(account.helperAssignedAt, null); assert.equal(account.helperAssignedById, null);
  assert.equal((db.prepare('SELECT content FROM Reply').get() as { content: string }).content, 'Existing response');
  assert.equal((db.prepare('SELECT count(*) AS count FROM HelpRequest').get() as { count: number }).count, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

test('malformed JSON, invalid types, huge bodies, and cross-origin mutations are rejected', async () => {
  for (const body of ['{bad', 'null', '[]', '"string"']) {
    assert.equal((await register(new Request(`${origin}/api/auth/register`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body }))).status, 400);
  }
  for (const value of [null, 42, [], {}]) assert.equal((await register(request('/api/auth/register', { email: value }))).status, 400);
  for (const suppliedOrigin of [null, 'https://attacker.invalid']) {
    const req = request('/api/auth/register', { email });
    if (suppliedOrigin) req.headers.set('Origin', suppliedOrigin); else req.headers.delete('Origin');
    assert.equal((await register(req)).status, 403);
  }
  const huge = request('/api/auth/register', { email, padding: 'a'.repeat(20_000) });
  assert.equal((await register(huge)).status, 413);
  const wrongType = request('/api/auth/register', { email });
  wrongType.headers.set('Content-Type', 'text/plain');
  assert.equal((await register(wrongType)).status, 415);
});

test('verified registration, login, me, post, reply, feed and logout form a persisted scoped flow', async () => {
  assert.equal((await register(request('/api/auth/register', { email: email.toUpperCase() }))).status, 200);
  assert.equal(sentMessages, 1);
  const storedOtp = await getPrisma().otp.findUniqueOrThrow({ where: { email } });
  assert.match(storedOtp.digest, /^[a-f0-9]{64}$/);
  assert.notEqual(storedOtp.digest, capturedOtp);
  const verified = await verify(request('/api/auth/verify', registrationBody()));
  assert.equal(verified.status, 200);
  assert.deepEqual(await verified.json(), { redirectTo: '/poster' });
  assert.match(verified.headers.get('set-cookie') ?? '', /HttpOnly/i);
  assert.match(verified.headers.get('set-cookie') ?? '', /SameSite=lax/i);
  assert.equal(await getPrisma().otp.count(), 0);
  const account = await getPrisma().user.findUniqueOrThrow({ where: { email } });
  assert.equal(account.role, 'POSTER');
  assert.ok(account.emailVerifiedAt);
  assert.equal(account.helperAssignedAt, null);
  assert.equal(account.studyYear, 4);
  assert.equal(account.collegeId, 'centurion');
  assert.notEqual(account.password, password);
  assert.equal(await bcrypt.compare(password, account.password), true);
  const loggedIn = await login(request('/api/auth/login', { email, password }));
  assert.equal(loggedIn.status, 200);
  assert.deepEqual(await loggedIn.json(), { redirectTo: '/poster' });
  const token = /auth-token=([^;]+)/.exec(loggedIn.headers.get('set-cookie') ?? '')?.[1];
  assert.ok(token);
  const profile = await me(request('/api/me', undefined, token));
  const profileBody = await profile.json();
  assert.deepEqual(Object.keys(profileBody.user).sort(), ['collegeId', 'id', 'name', 'role', 'studyYear']);
  const posted = await ask(request('/api/posts', { title: 'How do I prepare for placements?', content: 'What should I study before the placement season?', category: 'Placements', authorId: 'spoof', collegeId: 'other' }, token));
  assert.equal(posted.status, 201);
  const { post } = await posted.json();
  assert.equal(post.author.id, account.id);
  const otherMember = await member('013');
  const answered = await reply(request(`/api/posts/${post.id}/replies`, { content: 'Start with the campus placement guide.', authorId: 'spoof', collegeId: 'other' }, otherMember.token), { params: Promise.resolve({ id: post.id }) });
  assert.equal(answered.status, 201);
  const response = await feed(request('/api/posts?collegeId=other', undefined, token));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { posts } = await response.json();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].replies[0].author.id, otherMember.user.id);
  assert.equal(posts[0].replies[0].content, 'Start with the campus placement guide.');
  assert.deepEqual(Object.keys(posts[0].author).sort(), ['id', 'name', 'role', 'studyYear']);
  assert.equal(JSON.stringify(posts).includes(email), false);
  assert.equal(JSON.stringify(posts).includes('password'), false);
  const signedOut = await logout(request('/api/auth/logout', {}, token));
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.headers.get('set-cookie') ?? '', /Max-Age=0/);
  assert.equal((await me(request('/api/me'))).status, 401);
});

test('public signup rejects forged HELPER/ADMIN roles and invalid years/passwords', async () => {
  for (const body of [
    { ...registrationBody('123456'), role: 'HELPER' },
    { ...registrationBody('123456'), role: 'ADMIN' },
    ...[undefined, null, '2', 0, 7, 1.5].map((studyYear) => ({ ...registrationBody('123456'), studyYear })),
    { ...registrationBody('123456'), password: 'short' },
    { ...registrationBody('123456'), password: 'é'.repeat(37) },
    { ...registrationBody('123456'), otp: 123456 },
    { ...registrationBody('123456'), fullName: {} },
  ]) assert.equal((await verify(request('/api/auth/verify', body))).status, 400);
  assert.equal(await getPrisma().user.count(), 0);
});

test('browser and API password validation agree on minimum length, UTF-8 bytes and whitespace', () => {
  const cases: [unknown, boolean, boolean][] = [
    ['12345678', true, true],
    ['1234567', false, true],
    ['a'.repeat(72), true, true],
    ['a'.repeat(73), false, false],
    ['é'.repeat(36), true, true],
    ['é'.repeat(37), false, false],
    ['😀'.repeat(18), true, true],
    ['😀'.repeat(19), false, false],
    ['  no-trimming  ', true, true],
    ['password\0', false, false],
    ['', false, false],
    [undefined, false, false],
    [null, false, false],
    [42, false, false],
    [{}, false, false],
  ];
  for (const [value, signupAllowed, loginAllowed] of cases) {
    for (const validate of [browserPasswordInput, verificationPasswordInput]) {
      for (const registering of [true, false]) {
        if (registering ? signupAllowed : loginAllowed) assert.equal(validate(value, registering), value);
        else assert.throws(() => validate(value, registering));
      }
    }
  }
});

test('correcting invalid signup details preserves the live challenge and accepts the eight-character minimum', async () => {
  await challenge();
  for (const details of [{ password: '1234567' }, { password: 'é'.repeat(37) }, { fullName: '  ' }]) {
    assert.equal((await verify(request('/api/auth/verify', { ...registrationBody('123456'), ...details }))).status, 400);
  }
  const pending = await getPrisma().otp.findUniqueOrThrow({ where: { email } });
  assert.equal(pending.attempts, 0);
  assert.equal(pending.delivered, true);
  const correctedPassword = '12345678';
  assert.equal((await verify(request('/api/auth/verify', { ...registrationBody('123456'), password: correctedPassword }))).status, 200);
  assert.equal((await login(request('/api/auth/login', { email, password: correctedPassword }))).status, 200);
  assert.equal(sentMessages, 0);
  assert.equal(await getPrisma().otp.count(), 0);
});

test('signup and login accept passwords at exactly 72 UTF-8 bytes without truncation', async () => {
  await challenge();
  const boundaryPassword = '😀'.repeat(18);
  assert.equal((await verify(request('/api/auth/verify', { ...registrationBody('123456'), password: boundaryPassword }))).status, 200);
  assert.equal((await login(request('/api/auth/login', { email, password: boundaryPassword }))).status, 200);
  assert.equal((await login(request('/api/auth/login', { email, password: `${boundaryPassword}x` }))).status, 400);
});

test('email failures return 503 and never leave usable challenges', async () => {
  mailFailure = true;
  assert.equal((await register(request('/api/auth/register', { email }))).status, 503);
  assert.equal(await getPrisma().otp.count(), 0);
  delete process.env.BREVO_API_KEY;
  try {
    assert.equal((await register(request('/api/auth/register', { email: '123456789014@cutm.ac.in' }))).status, 503);
    assert.equal(sentMessages, 1);
  } finally {
    process.env.BREVO_API_KEY = 'test-mail-boundary';
  }
});

test('provider failures log only safe diagnostics and never expose private response content', async () => {
  mailFailure = true;
  mailFailureStatus = 401;
  mailFailureMessage = `IP address denied for ${email}; sensitive-provider-payload test-mail-boundary`;
  const entries: unknown[][] = [];
  const logger = mock.method(console, 'error', (...args: unknown[]) => { entries.push(args); });
  try {
    const response = await register(request('/api/auth/register', { email }));
    assert.equal(response.status, 503);
    assert.equal(await getPrisma().otp.count(), 0);
    assert.deepEqual(entries, [['Email verification provider failure', { status: 401, reason: 'IP_ACCESS_DENIED' }]]);
    const exposed = JSON.stringify({ logs: entries, response: await response.json() });
    for (const privateValue of [email, 'sensitive-provider-payload', 'test-mail-boundary', capturedOtp]) assert.equal(exposed.includes(privateValue), false);
  } finally { logger.mock.restore(); }
});

test('OTP is expiring, delivered-only and has five atomic attempts', async () => {
  await challenge();
  for (let i = 0; i < 5; i++) assert.equal((await verify(request('/api/auth/verify', registrationBody('999999')))).status, 400);
  assert.equal((await getPrisma().otp.findUniqueOrThrow({ where: { email } })).attempts, 5);
  assert.equal((await verify(request('/api/auth/verify', registrationBody('123456')))).status, 429);
  await getPrisma().otp.update({ where: { email }, data: { attempts: 0, expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await verify(request('/api/auth/verify', registrationBody('123456')))).status, 400);
  await getPrisma().otp.update({ where: { email }, data: { expiresAt: new Date(Date.now() + 60_000), delivered: false } });
  assert.equal((await verify(request('/api/auth/verify', registrationBody('123456')))).status, 400);
  assert.equal(await getPrisma().user.count(), 0);
});

test('missing session configuration preserves the verification challenge and its attempts', async () => {
  await challenge();
  const secret = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.equal((await verify(request('/api/auth/verify', registrationBody('123456')))).status, 503);
    assert.equal(await getPrisma().user.count(), 0);
    assert.equal((await getPrisma().otp.findUniqueOrThrow({ where: { email } })).attempts, 0);
  } finally { process.env.JWT_SECRET = secret; }
  assert.equal((await verify(request('/api/auth/verify', registrationBody('123456')))).status, 200);
});

test('OTP cannot create multiple accounts under simultaneous replay', async () => {
  await challenge();
  const results = await Promise.all([verify(request('/api/auth/verify', registrationBody('123456'))), verify(request('/api/auth/verify', registrationBody('123456')))]);
  assert.equal(results.filter((response) => response.status === 200).length, 1);
  assert.equal(await getPrisma().user.count(), 1);
  assert.equal(await getPrisma().otp.count(), 0);
  assert.equal((await verify(request('/api/auth/verify', registrationBody('123456')))).status, 400);
});

test('resending is throttled and replaces, rather than accumulates, challenges', async () => {
  assert.equal((await register(request('/api/auth/register', { email }))).status, 200);
  const first = await getPrisma().otp.findUniqueOrThrow({ where: { email } });
  const blocked = await register(request('/api/auth/register', { email }));
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
  await getPrisma().rateLimit.update({ where: { key: rateKey('register-resend', email) }, data: { expiresAt: BigInt(Date.now() - 1) } });
  assert.equal((await register(request('/api/auth/register', { email }))).status, 200);
  assert.equal(await getPrisma().otp.count(), 1);
  assert.notEqual((await getPrisma().otp.findUniqueOrThrow({ where: { email } })).id, first.id);
});

test('throttled signup can recover only a delivered, unexpired code with attempts remaining', async () => {
  assert.equal((await register(request('/api/auth/register', { email }))).status, 200);
  const original = await getPrisma().otp.findUniqueOrThrow({ where: { email } });
  const throttled = await register(request('/api/auth/register', { email }));
  assert.equal(throttled.status, 429);
  const recovered = await throttled.json();
  assert.equal(recovered.useExistingCode, true);
  assert.ok(Number(throttled.headers.get('retry-after')) > 0 && Number(throttled.headers.get('retry-after')) <= 60);
  const pending = await getPrisma().otp.findUniqueOrThrow({ where: { email } });
  assert.equal(pending.digest, original.digest);
  assert.equal(pending.attempts, 0);
  assert.equal(sentMessages, 1);
  for (const update of [
    { delivered: false },
    { delivered: true, expiresAt: new Date(Date.now() - 1000) },
    { expiresAt: new Date(Date.now() + 60_000), attempts: 5 },
  ]) {
    await getPrisma().otp.update({ where: { email }, data: update });
    const response = await register(request('/api/auth/register', { email }));
    assert.equal(response.status, 429);
    assert.equal((await response.json()).useExistingCode, undefined);
  }
  assert.equal(sentMessages, 1);
});

test('throttling reports the remaining wait and never extends a blocked window', async () => {
  await consumeRateLimit('wait-test', 'fixture', 1, 60);
  const key = rateKey('wait-test', 'fixture');
  const expiresAt = BigInt(Date.now() + 10_000);
  await getPrisma().rateLimit.update({ where: { key }, data: { expiresAt } });
  await assert.rejects(consumeRateLimit('wait-test', 'fixture', 1, 60), error => {
    assert.ok(error instanceof Error && 'retryAfter' in error && typeof error.retryAfter === 'number');
    assert.ok(error.retryAfter > 0 && error.retryAfter <= 10);
    return true;
  });
  const stored = await getPrisma().rateLimit.findUniqueOrThrow({ where: { key } });
  assert.equal(stored.count, 1);
  assert.equal(stored.expiresAt, expiresAt);
});

test('shared-campus registration admits more than ten students but keeps a bounded IP budget', async () => {
  for (let student = 0; student < 11; student++) {
    const campusEmail = `123456789${String(student).padStart(3, '0')}@cutm.ac.in`;
    assert.equal((await register(request('/api/auth/register', { email: campusEmail }))).status, 200);
  }
  assert.equal(sentMessages, 11);
  await getPrisma().rateLimit.update({ where: { key: rateKey('register-ip', 'local') }, data: { count: 299 } });
  assert.equal((await register(request('/api/auth/register', { email: '123456789100@cutm.ac.in' }))).status, 200);
  const blocked = await register(request('/api/auth/register', { email: '123456789101@cutm.ac.in' }));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '3600');
  assert.equal(sentMessages, 12);
});

test('a larger campus budget does not weaken three-per-hour and one-per-minute email limits', async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal((await register(request('/api/auth/register', { email }))).status, 200);
    await getPrisma().rateLimit.update({ where: { key: rateKey('register-resend', email) }, data: { expiresAt: BigInt(Date.now() - 1) } });
  }
  assert.equal((await register(request('/api/auth/register', { email: email.toUpperCase() }))).status, 429);
  assert.equal(sentMessages, 3);
  assert.equal(await getPrisma().otp.count(), 1);
});

test('shared-campus login allows a busy NAT but rejects requests beyond its IP budget', async () => {
  await member();
  await consumeRateLimit('login-ip', 'local', 600, 900);
  await getPrisma().rateLimit.update({ where: { key: rateKey('login-ip', 'local') }, data: { count: 60 } });
  assert.equal((await login(request('/api/auth/login', { email, password }))).status, 200);
  await getPrisma().rateLimit.update({ where: { key: rateKey('login-ip', 'local') }, data: { count: 599 } });
  assert.equal((await login(request('/api/auth/login', { email, password }))).status, 200);
  const blocked = await login(request('/api/auth/login', { email, password }));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '900');
});

test('request identity trusts only a valid Vercel-overwritten address, never client forwarding headers', () => {
  const req = request('/api/auth/login', { email, password });
  req.headers.set('x-forwarded-for', '198.51.100.1');
  req.headers.set('x-real-ip', '198.51.100.2');
  req.headers.set('x-vercel-forwarded-for', '198.51.100.3');
  assert.equal(requestIdentity(req, { NODE_ENV: 'test' }), 'local');
  assert.equal(requestIdentity(req, { NODE_ENV: 'production', VERCEL: '1' }), '198.51.100.3');
  req.headers.set('x-vercel-forwarded-for', '2001:db8::1');
  assert.equal(requestIdentity(req, { NODE_ENV: 'production', VERCEL: '1' }), '2001:db8::1');
  for (const header of ['', 'not-an-ip', '198.51.100.3, 198.51.100.4']) {
    req.headers.set('x-vercel-forwarded-for', header);
    assert.throws(() => requestIdentity(req, { NODE_ENV: 'production', VERCEL: '1' }), /unavailable/);
  }
  req.headers.delete('x-vercel-forwarded-for');
  assert.throws(() => requestIdentity(req, { NODE_ENV: 'production', VERCEL: '1' }), /unavailable/);
  assert.throws(() => requestIdentity(req, { NODE_ENV: 'production' }), /unavailable/);
  assert.throws(() => requestIdentity(req, { NODE_ENV: 'test', VERCEL_ENV: 'preview' }), /unavailable/);
});

test('production local testing needs explicit opt-in and a loopback URL, not a forged header', () => {
  const env = { NODE_ENV: 'production', AUTH_LOCAL_TESTING: '1' };
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(requestIdentity(new Request(`http://${host}:3000/api/auth/login`), env), 'local');
  }
  const publicRequest = new Request('https://campus.example.invalid/api/auth/login', {
    headers: { 'x-forwarded-host': 'localhost', 'x-forwarded-for': '127.0.0.1', 'x-vercel-forwarded-for': '127.0.0.1' },
  });
  assert.throws(() => requestIdentity(publicRequest, env), /unavailable/);
  assert.throws(() => requestIdentity(request('/api/auth/login', {}), { ...env, VERCEL_ENV: 'production' }), /unavailable/);
});

test('unsupported production ingress fails before database writes or mail delivery', async () => {
  Object.assign(process.env, { NODE_ENV: 'production' });
  try {
    for (const [path, handler] of [['register', register], ['login', login]] as const) {
      const req = request(`/api/auth/${path}`, { email, password });
      req.headers.set('x-forwarded-for', '198.51.100.1');
      req.headers.set('x-vercel-forwarded-for', '198.51.100.2');
      assert.equal((await handler(req)).status, 503);
    }
    assert.equal(sentMessages, 0);
    assert.equal(await getPrisma().rateLimit.count(), 0);
    assert.equal(await getPrisma().otp.count(), 0);
  } finally {
    Object.assign(process.env, { NODE_ENV: 'test' });
  }
});

test('database rate limiter admits exactly its budget during concurrent requests', async () => {
  const results = await Promise.allSettled(Array.from({ length: 15 }, () => consumeRateLimit('test-race', 'fixture', 3, 60)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 3);
  const bucket = await getPrisma().rateLimit.findUniqueOrThrow({ where: { key: rateKey('test-race', 'fixture') } });
  assert.equal(bucket.count, 3);
  await getPrisma().rateLimit.update({ where: { key: bucket.key }, data: { expiresAt: BigInt(Date.now() - 1) } });
  await consumeRateLimit('test-race', 'fixture', 3, 60);
  assert.equal((await getPrisma().rateLimit.findUniqueOrThrow({ where: { key: bucket.key } })).count, 1);
});

test('login rejects wrong credentials, limits repeated attempts and keeps password whitespace', async () => {
  await member();
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await login(request('/api/auth/login', { email, password: `${password} ` }))).status, 401);
  }
  assert.equal((await login(request('/api/auth/login', { email, password }))).status, 429);
  assert.equal((await login(request('/api/auth/login', { email, password: {} }))).status, 400);
});

test('cross-college questions and replies stay hidden even with spoofed client scope', async () => {
  const student = await member();
  const outsider = await member('014', 'other');
  const hiddenPost = await getPrisma().post.create({ data: { title: 'Foreign question', content: 'Private campus content', authorId: outsider.user.id, collegeId: 'other' } });
  const ownPost = await getPrisma().post.create({ data: { title: 'Our question', content: 'Our campus content', authorId: student.user.id } });
  await getPrisma().reply.create({ data: { content: 'Should not leak', collegeId: 'other', postId: ownPost.id, authorId: outsider.user.id } });
  const { posts } = await (await feed(request('/api/posts?collegeId=other', undefined, student.token))).json();
  assert.deepEqual(posts.map((post: { id: string }) => post.id), [ownPost.id]);
  assert.equal(posts[0].replies.length, 0);
  assert.equal((await reply(request(`/api/posts/${hiddenPost.id}/replies`, { content: 'Cross-scope reply' }, student.token), { params: Promise.resolve({ id: hiddenPost.id }) })).status, 404);
  assert.equal((await me(request('/api/me', undefined, outsider.token))).status, 403);
});

test('feed returns the newest 30 questions only', async () => {
  const student = await member();
  for (let i = 0; i < 32; i++) await getPrisma().post.create({ data: { title: `Question ${i}`, content: 'Question body', authorId: student.user.id, createdAt: new Date(2026, 0, 1, 0, i) } });
  const { posts } = await (await feed(request('/api/posts', undefined, student.token))).json();
  assert.equal(posts.length, 30);
  assert.equal(posts[0].title, 'Question 31');
  assert.equal(posts[29].title, 'Question 2');
});

test('authentication re-reads membership/role and rejects deleted accounts and forged cookies', async () => {
  const student = await member();
  await getPrisma().user.update({ where: { id: student.user.id }, data: { role: 'HELPER' } });
  assert.equal((await (await me(request('/api/me', undefined, student.token))).json()).user.role, 'POSTER');
  const admin = await member('015');
  await getPrisma().user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
  await appointHelper(await requireUser(request('/api/me', undefined, admin.token)), student.user.id, true);
  assert.equal((await (await me(request('/api/me', undefined, student.token))).json()).user.role, 'HELPER');
  await getPrisma().roleAudit.deleteMany();
  await getPrisma().user.delete({ where: { id: student.user.id } });
  assert.equal((await me(request('/api/me', undefined, student.token))).status, 401);
  assert.equal((await ask(request('/api/posts', { title: 'Valid title', content: 'A valid question body', category: 'Academics' }, 'forged'))).status, 401);
  assert.equal((await feed(request('/api/posts'))).status, 401);
});

test('poster dashboard isolates personal notices and private help, counts full history, and exposes safe fields', async () => {
  const student = await member();
  const peer = await member('013');
  const outsider = await member('014', 'other');
  const db = getPrisma();
  const personal = [];
  for (let i = 0; i < 10; i++) personal.push(await db.post.create({ data: { title: `Personal question ${i}`, content: 'Saved college question', authorId: student.user.id, createdAt: new Date(2026, 0, 1, 0, i) } }));
  const peersQuestion = await db.post.create({ data: { title: 'Peer question', content: 'Not a personal question', authorId: peer.user.id } });
  const foreignQuestion = await db.post.create({ data: { title: 'Foreign question', content: 'Never expose foreign content', authorId: outsider.user.id, collegeId: 'other' } });
  for (let i = 0; i < 2; i++) await db.reply.create({ data: { content: `Reply ${i}`, authorId: peer.user.id, postId: personal[9].id, collegeId: 'centurion' } });
  await db.reply.create({ data: { content: 'Spoofed foreign reply', authorId: outsider.user.id, postId: personal[8].id, collegeId: 'centurion' } });
  await db.reply.create({ data: { content: 'My helpful reply', authorId: student.user.id, postId: peersQuestion.id, collegeId: 'centurion' } });
  await db.reply.create({ data: { content: 'Invalid foreign contribution', authorId: student.user.id, postId: foreignQuestion.id, collegeId: 'centurion' } });
  const response = await dashboard(request('/api/dashboard?collegeId=other&userId=spoof&role=HELPER', undefined, student.token));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.role, 'POSTER');
  assert.deepEqual(body.stats, { noticesPosted: 10, helpTotal: 0, unansweredHelp: 0, answeredByYou: 0 });
  assert.equal(body.notices.length, 8);
  assert.equal(body.notices[0].title, 'Personal question 9');
  assert.ok(body.notices.every((post: { author: { id: string } }) => post.author.id === student.user.id));
  assert.deepEqual(body.helpRequests, []);
  assert.deepEqual(body.helpedRequests, []);
  for (const privateValue of [student.user.email, student.user.password, 'Spoofed foreign reply', 'Never expose foreign content']) assert.equal(JSON.stringify(body).includes(privateValue), false);
  const loginResponse = await login(request('/api/auth/login', { email, password }));
  assert.deepEqual(await loginResponse.json(), { redirectTo: '/poster' });
});

test('helper dashboard moves saved replies from the waiting queue to contributions and re-reads roles', async () => {
  const helper = await member();
  const student = await member('013');
  const outsider = await member('014', 'other');
  const db = getPrisma();
  // This cookie still claims POSTER. API authorization must use the current DB role.
  const admin = await member('015');
  await db.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
  await appointHelper(await requireUser(request('/api/me', undefined, admin.token)), helper.user.id, true);
  const question = await db.helpRequest.create({ data: { title: 'Need some advice', content: 'How should I approach this?', authorId: student.user.id, collegeId: 'centurion' } });
  await db.post.create({ data: { title: 'A public notice', content: 'Not a private help request', authorId: helper.user.id } });
  await db.helpRequest.create({ data: { title: 'Foreign question', content: 'Never show it', authorId: outsider.user.id, collegeId: 'other' } });
  await db.helpReply.create({ data: { content: 'Out of scope reply', requestId: question.id, authorId: outsider.user.id, collegeId: 'other' } });
  let body = await (await dashboard(request('/api/dashboard', undefined, helper.token))).json();
  assert.equal(body.role, 'HELPER');
  assert.equal(body.stats.unansweredHelp, 1);
  assert.deepEqual(body.helpRequests.map((post: { id: string }) => post.id), [question.id]);
  assert.equal(body.helpRequests[0]._count.replies, 0);
  assert.equal((await helpReply(request(`/api/help-requests/${question.id}/replies`, { content: 'Start with this useful guide.' }, helper.token), { params: Promise.resolve({ id: question.id }) })).status, 201);
  body = await (await dashboard(request('/api/dashboard', undefined, helper.token))).json();
  assert.equal(body.stats.unansweredHelp, 0);
  assert.equal(body.stats.answeredByYou, 1);
  assert.deepEqual(body.helpRequests, []);
  assert.deepEqual(body.helpedRequests.map((post: { id: string }) => post.id), [question.id]);
  assert.equal(body.helpedRequests[0].replies[0].content, 'Start with this useful guide.');
  await db.user.update({ where: { id: helper.user.id }, data: { role: 'ADMIN' } });
  assert.equal((await dashboard(request('/api/dashboard', undefined, helper.token))).status, 403);
  assert.equal((await dashboard(request('/api/dashboard', undefined, outsider.token))).status, 403);
  assert.equal((await dashboard(request('/api/dashboard'))).status, 401);
  assert.equal((await dashboard(request('/api/dashboard', undefined, 'forged'))).status, 401);
});

test('JWT issuer/audience/claim typing/expiration and missing configuration are enforced', async () => {
  const valid = await issueSessionToken({ id: 'student', role: 'HELPER' });
  assert.deepEqual(await verifySessionToken(valid), { id: 'student', role: 'HELPER' });
  for (const options of [
    { issuer: 'wrong', audience: 'bachaoo-campus', role: 'POSTER', expiry: '1h' },
    { issuer: 'bachaoo', audience: 'wrong', role: 'POSTER', expiry: '1h' },
    { issuer: 'bachaoo', audience: 'bachaoo-campus', role: 1, expiry: '1h' },
    { issuer: 'bachaoo', audience: 'bachaoo-campus', role: 'POSTER', expiry: '-1h' },
  ]) {
    const token = await new SignJWT({ role: options.role }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject('student').setIssuedAt().setIssuer(options.issuer).setAudience(options.audience).setExpirationTime(options.expiry).sign(signingKey());
    assert.equal(await verifySessionToken(token), null);
  }
  delete process.env.JWT_SECRET;
  try {
    assert.equal((await me(request('/api/me', undefined, valid))).status, 503);
    assert.equal((await login(request('/api/auth/login', { email, password }))).status, 503);
  } finally {
    process.env.JWT_SECRET = 'isolated-tests-only-not-a-real-secret-123456789';
  }
});

test('invalid post/reply fields return 400 and never create rows', async () => {
  const student = await member();
  for (const body of [
    { title: {}, content: 'Question content', category: 'Academics' },
    { title: 'Fine title', content: [], category: 'Academics' },
    { title: 'Fine title', content: 'Question content', category: 'Unknown' },
    { title: 'Fine title', content: 'x'.repeat(5001), category: 'Projects' },
  ]) assert.equal((await ask(request('/api/posts', body, student.token))).status, 400);
  assert.equal((await reply(request('/api/posts/not-an-id/replies', { content: {} }, student.token), { params: Promise.resolve({ id: 'not-an-id' }) })).status, 400);
  assert.equal(await getPrisma().post.count(), 0);
});

test('proxy gates protected sections optimistically; DB-backed pages/APIs enforce roles', async () => {
  for (const path of ['/campus', '/poster', '/helper', '/superadmin']) {
    for (const headers of [{} as HeadersInit, { Cookie: 'auth-token=invalid-session' }]) {
      const result = await proxy(new NextRequest(`${origin}${path}`, { headers }));
      assert.equal(result.headers.get('location'), `${origin}/login`);
    }
  }
  const helper = await issueSessionToken({ id: 'helper', role: 'HELPER' });
  assert.equal((await proxy(new NextRequest(`${origin}/poster`, { headers: { Cookie: `auth-token=${helper}` } }))).status, 200);
  const poster = await issueSessionToken({ id: 'student', role: 'POSTER' });
  assert.equal((await proxy(new NextRequest(`${origin}/helper`, { headers: { Cookie: `auth-token=${poster}` } }))).status, 200);
  assert.equal((await proxy(new NextRequest(`${origin}/superadmin`, { headers: { Cookie: `auth-token=${helper}` } }))).status, 200);
  const admin = await issueSessionToken({ id: 'operator', role: 'ADMIN' });
  assert.equal((await proxy(new NextRequest(`${origin}/superadmin`, { headers: { Cookie: `auth-token=${admin}` } }))).status, 200);
});

test('production login cookies use Secure and logout enforces same-origin', async () => {
  await member();
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_LOCAL_TESTING: '1' });
  try {
    const response = await login(request('/api/auth/login', { email, password }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie') ?? '', /; Secure/i);
  } finally {
    Object.assign(process.env, { NODE_ENV: 'test' });
    delete process.env.AUTH_LOCAL_TESTING;
  }
  const foreign = request('/api/auth/logout', {});
  foreign.headers.set('Origin', 'https://attacker.invalid');
  assert.equal((await logout(foreign)).status, 403);
});
