import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../src/generated/prisma/client';
import { applyLibsqlMigrations } from '../prisma/libsql-migrations';
import { reserveDailyQuota } from '../src/lib/quotas';

test('libSQL migrations are idempotent and Prisma persists scoped relations/transactions through its adapter', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bachaoo-libsql-'));
  const url = `file:${join(directory, 'database.db')}`;
  const client = createClient({ url });
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }), log: [] });
  try {
    const applied = await applyLibsqlMigrations(client, resolve('prisma/migrations'));
    assert.equal(applied.length, 3);
    assert.deepEqual(await applyLibsqlMigrations(client, resolve('prisma/migrations')), []);
    const user = await prisma.user.create({ data: { email: '123456789012@cutm.ac.in', name: 'LibSQL Student', password: 'fixture-hash', studyYear: 3, emailVerifiedAt: new Date() } });
    const post = await prisma.post.create({ data: { title: 'Adapter test', content: 'Stored through libSQL', authorId: user.id } });
    await prisma.$transaction(async (tx) => {
      await tx.reply.create({ data: { content: 'Persisted reply', postId: post.id, authorId: user.id, collegeId: 'centurion' } });
    });
    const stored = await prisma.post.findFirstOrThrow({ where: { collegeId: 'centurion' }, include: { replies: true } });
    assert.equal(stored.replies[0].content, 'Persisted reply');
    assert.ok(stored.createdAt instanceof Date);
    assert.equal(await prisma.user.count(), 1);
    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.post.delete({ where: { id: post.id } });
      throw new Error('Intentional transaction rollback');
    }));
    assert.equal(await prisma.post.count(), 1);
    assert.equal(await prisma.reply.count(), 1);
    const member = { ...user, role: 'POSTER' as const };
    await assert.rejects(prisma.$transaction(async tx => {
      await reserveDailyQuota(tx, member, 'HELP_REQUEST');
      throw new Error('Rollback publication and quota together');
    }));
    assert.equal(await prisma.dailyQuota.count(), 0);
    await prisma.$transaction(async tx => {
      await reserveDailyQuota(tx, member, 'HELP_REQUEST');
      await tx.helpRequest.create({ data: { title: 'Private adapter request', content: 'Separate help content', collegeId: user.collegeId, authorId: user.id } });
    });
    await assert.rejects(prisma.$transaction(tx => reserveDailyQuota(tx, member, 'HELP_REQUEST')), /already submitted/);
    assert.equal(await prisma.helpRequest.count(), 1);
    assert.equal(await prisma.dailyQuota.count(), 1);
  } finally {
    await prisma.$disconnect();
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('libSQL migration failures roll back and checksum changes are refused', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bachaoo-migration-'));
  const client = createClient({ url: `file:${join(directory, 'database.db')}` });
  const migrationDirectory = join(directory, 'migrations');
  const first = join(migrationDirectory, '0001_test');
  const second = join(migrationDirectory, '0002_test');
  try {
    await mkdir(first, { recursive: true });
    await writeFile(join(first, 'migration.sql'), 'CREATE TABLE Example (id TEXT PRIMARY KEY);');
    await applyLibsqlMigrations(client, migrationDirectory);
    await client.execute("INSERT INTO Example (id) VALUES ('keep-me')");
    await mkdir(second);
    await writeFile(join(second, 'migration.sql'), 'CREATE TABLE Partial (id TEXT); INSERT INTO MissingTable (id) VALUES (1);');
    await assert.rejects(applyLibsqlMigrations(client, migrationDirectory));
    assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE name = 'Partial'")).rows.length, 0);
    assert.equal((await client.execute('SELECT id FROM Example')).rows[0].id, 'keep-me');
    assert.equal((await client.execute('SELECT * FROM _prisma_migrations')).rows.length, 1);
    const original = await readFile(join(first, 'migration.sql'), 'utf8');
    await writeFile(join(first, 'migration.sql'), `${original}\n-- changed`);
    await assert.rejects(applyLibsqlMigrations(client, migrationDirectory), /history mismatch/);
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
