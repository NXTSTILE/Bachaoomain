// Production-server browser test using only disposable DB rows and fixture credentials.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../src/lib/prisma';
import { appointHelper } from '../src/lib/admin';
import { invitationDigest } from '../src/lib/admin-invite';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'bachaoo-browser-'));
  const database = join(directory, 'fixture.db');
  const port = process.env.TEST_PORT || '3210';
  const base = `http://localhost:${port}`;
  Object.assign(process.env, {
    NODE_ENV: 'production', DATABASE_URL: `file:${database}`, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '',
    JWT_SECRET: 'isolated-browser-fixture-not-a-production-secret',
    BREVO_API_KEY: '', BREVO_SENDER_EMAIL: 'sender@example.invalid', SUPPORT_EMAIL: 'support@example.invalid',
    NEXT_PUBLIC_SITE_URL: 'https://fixture.example.invalid', REGISTRATION_OPEN: 'false',
    VERCEL: '', VERCEL_ENV: '', AUTH_LOCAL_TESTING: '1',
  });
  const sqlite = new Database(database);
  for (const name of readdirSync('prisma/migrations').filter(name => /^\d/.test(name)).sort()) sqlite.exec(readFileSync(join('prisma/migrations', name, 'migration.sql'), 'utf8'));
  sqlite.close();
  const prisma = getPrisma();
  const user = await prisma.user.create({ data: { email: '123456789012@cutm.ac.in', name: 'Browser Student', password: await bcrypt.hash('browser-fixture-password', 4), studyYear: 3, emailVerifiedAt: new Date() } });
  const helper = await prisma.user.create({ data: { email: '123456789013@cutm.ac.in', name: 'Browser Helper', password: await bcrypt.hash('browser-helper-password', 4), studyYear: 4, emailVerifiedAt: new Date() } });
  const peer = await prisma.user.create({ data: { email: '123456789014@cutm.ac.in', name: 'Browser Peer', password: 'unused-fixture', studyYear: 2, emailVerifiedAt: new Date() } });
  const admin = await prisma.user.create({ data: { email: 'admin.browser@example.invalid', name: 'Browser Operator', password: 'unused-fixture', role: 'ADMIN', emailVerifiedAt: new Date() } });
  await appointHelper({ ...admin, role: 'ADMIN' }, helper.id, true);
  await prisma.helpRequest.create({ data: { title: 'Another Poster’s private fixture', content: 'Only its requester and appointed Helpers may see this.', authorId: peer.id, collegeId: 'centurion' } });
  await prisma.adminInvite.create({ data: { email: 'invited.browser@example.invalid', collegeId: 'centurion', digest: invitationDigest('a'.repeat(64)), delivered: true, expiresAt: new Date(Date.now() + 600_000) } });
  const post = await prisma.post.create({ data: { title: 'A fixture question with a long discussion', content: 'Browser pagination must keep older answers available.', authorId: user.id } });
  for (let i = 1; i <= 35; i++) await prisma.reply.create({ data: { content: `Fixture answer ${i}`, authorId: user.id, postId: post.id, collegeId: 'centurion', createdAt: new Date(2026, 0, 1, 0, i) } });
  let server: ChildProcess | undefined;
  let authServer: ChildProcess | undefined;
  try {
    // No real email provider key is present. Signup is explicitly closed; login
    // and persisted board behavior remain available for the seeded member.
    const serverArgs = ['--require', './tests/browser-network.cjs', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port'];
    server = spawn(process.execPath, [...serverArgs, port], { env: process.env, stdio: 'inherit' });
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error('Production test server exited before readiness.');
      try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Wait for startup. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'Production test server started');
    const browser = spawn(process.execPath, ['tests/browser-smoke.mjs'], { env: { ...process.env, TEST_BASE_URL: base, TEST_PILOT: '1', TEST_MEMBER_FLOW: '1' }, stdio: 'inherit' });
    const [code] = await once(browser, 'exit');
    assert.equal(code, 0, 'Browser checks passed');
    // Also audit the open signup/OTP UI. Every auth mutation in this phase is
    // intercepted by Playwright, and the fixture preload blocks external fetches.
    const authPort = String(Number(port) + 1);
    const authBase = `http://localhost:${authPort}`;
    authServer = spawn(process.execPath, [...serverArgs, authPort], { env: { ...process.env, REGISTRATION_OPEN: 'true', BREVO_API_KEY: 'isolated-ui-fixture-no-real-service-key' }, stdio: 'inherit' });
    let authReady = false;
    for (let index = 0; index < 120; index++) {
      if (authServer.exitCode !== null) throw new Error('Auth UI test server exited before readiness.');
      try { authReady = (await fetch(authBase, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Wait for startup. */ }
      if (authReady) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(authReady, 'Open auth UI fixture started');
    const authBrowser = spawn(process.execPath, ['tests/browser-smoke.mjs'], { env: { ...process.env, TEST_BASE_URL: authBase, TEST_PILOT: '0', TEST_MEMBER_FLOW: '0' }, stdio: 'inherit' });
    const [authCode] = await once(authBrowser, 'exit');
    assert.equal(authCode, 0, 'Signup and OTP browser checks passed');
    assert.equal(await prisma.post.count({ where: { title: 'Browser-created campus notice' } }), 1);
    assert.equal(await prisma.reply.count({ where: { content: 'Browser-created notice reply.' } }), 1);
    assert.equal(await prisma.helpRequest.count({ where: { title: 'Browser-created private help request' } }), 1);
    assert.equal(await prisma.helpReply.count({ where: { content: 'Browser-created private Helper response.' } }), 1);
    assert.equal(await prisma.dailyQuota.count({ where: { userId: user.id } }), 2);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: helper.id } })).role, 'POSTER');
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: peer.id } })).role, 'HELPER');
    assert.equal(await prisma.roleAudit.count({ where: { actor: { email: 'invited.browser@example.invalid' } } }), 3);
    console.info('PASS notice/help/replies/quotas and Admin appointments/audit persisted in the isolated database');
  } finally {
    for (const child of [server, authServer]) {
      if (child && child.exitCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGTERM');
        const force = setTimeout(() => child.kill('SIGKILL'), 5000);
        await exited;
        clearTimeout(force);
      }
    }
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(() => { console.error('Isolated browser verification failed. See the test output above.'); process.exitCode = 1; });
