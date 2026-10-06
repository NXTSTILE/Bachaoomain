import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getPrisma } from '../src/lib/prisma';
import { issueSessionToken } from '../src/lib/session';
import { REPLY_PAGE_LIMIT, REPLY_PREVIEW_LIMIT } from '../src/lib/posts';
import { GET as feed } from '../src/app/api/posts/route';
import { GET as replies } from '../src/app/api/posts/[id]/replies/route';

const directory = mkdtempSync(join(tmpdir(), 'bachaoo-feed-'));
const origin = 'http://localhost:3000';
let token: string;
let postId: string;
let foreignPostId: string;
let foreignReplyId: string;
let otherPostReplyId: string;
let expectedIds: string[];
let userId: string;
function request(path: string, cookie = token) {
  return new Request(`${origin}${path}`, { headers: cookie ? { Cookie: `auth-token=${cookie}` } : {} });
}
function page(id: string, before?: string) {
  return replies(request(`/api/posts/${id}/replies${before === undefined ? '' : `?before=${before}`}`), { params: Promise.resolve({ id }) });
}

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `file:${join(directory, 'test.db')}`, JWT_SECRET: 'isolated-feed-tests-not-a-real-secret-123456789' });
  for (const key of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];
  const db = new Database(join(directory, 'test.db'));
  for (const name of readdirSync('prisma/migrations').filter(name => /^\d/.test(name)).sort()) db.exec(readFileSync(join('prisma/migrations', name, 'migration.sql'), 'utf8'));
  db.close();
  const prisma = getPrisma();
  const user = await prisma.user.create({ data: { email: '123456789012@cutm.ac.in', name: 'Fixture', password: 'unused-fixture', studyYear: 3, emailVerifiedAt: new Date() } });
  userId = user.id;
  const outsider = await prisma.user.create({ data: { email: '123456789013@cutm.ac.in', name: 'Other college', password: 'unused-fixture', collegeId: 'other' } });
  token = await issueSessionToken({ id: user.id, role: 'POSTER' });
  const post = await prisma.post.create({ data: { title: 'Popular question', content: 'Lots of useful replies', authorId: user.id } });
  postId = post.id;
  foreignPostId = (await prisma.post.create({ data: { title: 'Foreign', content: 'Not visible', authorId: outsider.id, collegeId: 'other' } })).id;
  foreignReplyId = (await prisma.reply.create({ data: { content: 'Do not expose', postId, collegeId: 'other', authorId: outsider.id } })).id;
  const anotherPost = await prisma.post.create({ data: { title: 'Another question', content: 'Separate conversation', authorId: user.id } });
  otherPostReplyId = (await prisma.reply.create({ data: { content: 'Not a cursor for the first post', postId: anotherPost.id, authorId: user.id, collegeId: 'centurion' } })).id;
  for (let i = 0; i < 55; i++) {
    await prisma.reply.create({ data: { content: `Reply ${i}`, postId, authorId: user.id, collegeId: 'centurion', createdAt: new Date('2026-01-01T00:00:00Z') } });
  }
  expectedIds = (await prisma.reply.findMany({ where: { postId, collegeId: 'centurion' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } })).map(row => row.id);
});

after(async () => { await getPrisma().$disconnect(); rmSync(directory, { recursive: true, force: true }); });

test('feed sends a bounded newest-reply preview and a college-scoped count', async () => {
  const response = await feed(request('/api/posts'));
  assert.equal(response.status, 200);
  const post = (await response.json()).posts.find((item: { id: string }) => item.id === postId);
  assert.equal(post.replies.length, REPLY_PREVIEW_LIMIT);
  assert.equal(post._count.replies, 55);
  assert.deepEqual(post.replies.map((reply: { id: string }) => reply.id), expectedIds.slice(0, REPLY_PREVIEW_LIMIT));
  assert.equal(JSON.stringify(post).includes('Do not expose'), false);
  assert.equal(JSON.stringify(post).includes('password'), false);
});

test('reply pagination retrieves every tied-timestamp reply once in bounded pages', async () => {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const response = await page(postId, cursor);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.ok(body.replies.length <= REPLY_PAGE_LIMIT);
    ids.push(...body.replies.map((reply: { id: string }) => reply.id));
    cursor = body.nextCursor || undefined;
  } while (cursor);
  assert.deepEqual(ids, expectedIds);
  const continuation = await (await page(postId, expectedIds[REPLY_PREVIEW_LIMIT - 1])).json();
  assert.deepEqual(continuation.replies.map((reply: { id: string }) => reply.id), expectedIds.slice(REPLY_PREVIEW_LIMIT, REPLY_PREVIEW_LIMIT + REPLY_PAGE_LIMIT));
});

test('reply history rejects anonymous callers, foreign posts and out-of-scope cursors', async () => {
  assert.equal((await replies(request(`/api/posts/${postId}/replies`, ''), { params: Promise.resolve({ id: postId }) })).status, 401);
  assert.equal((await page(foreignPostId)).status, 404);
  for (const cursor of ['invalid', '', foreignReplyId, otherPostReplyId, '00000000-0000-0000-0000-000000000000']) assert.equal((await page(postId, cursor)).status, 400);
  assert.equal((await page('invalid')).status, 404);
});

test('personal notice history paginates all saved notices with scoped cursors and topic/search filters', async () => {
  const db = getPrisma();
  const peer = await db.user.create({ data: { email: '123456789014@cutm.ac.in', name: 'Peer', password: 'unused-fixture', emailVerifiedAt: new Date() } });
  const peerPost = await db.post.create({ data: { title: 'Peer project notice', content: 'Not part of your own history', category: 'Projects', authorId: peer.id } });
  for (let index = 0; index < 35; index++) await db.post.create({ data: { title: `Saved notice ${index}`, content: 'A persisted campus announcement', category: index % 2 ? 'Campus life' : 'Projects', authorId: userId, createdAt: new Date('2030-01-01T00:00:00Z') } });
  const expected = await db.post.findMany({ where: { authorId: userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const response = await feed(request(`/api/posts?scope=mine${cursor ? `&before=${cursor}` : ''}`));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.posts.length <= 30);
    assert.ok(body.posts.every((post: { author: { id: string } }) => post.author.id === userId));
    ids.push(...body.posts.map((post: { id: string }) => post.id));
    cursor = body.nextCursor;
  } while (cursor);
  assert.deepEqual(ids, expected.map(post => post.id));
  assert.equal((await feed(request(`/api/posts?scope=mine&before=${peerPost.id}`))).status, 400);
  assert.equal((await feed(request('/api/posts?scope=invalid'))).status, 400);
  const filtered = await (await feed(request('/api/posts?scope=mine&category=Projects&q=Saved'))).json();
  assert.equal(filtered.posts.length, 18);
  assert.ok(filtered.posts.every((post: { category: string; title: string }) => post.category === 'Projects' && post.title.startsWith('Saved notice')));
  assert.equal(filtered.nextCursor, null);
  assert.equal((await feed(request('/api/posts?scope=mine', ''))).status, 401);
});
