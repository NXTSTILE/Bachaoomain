// Read-only post-migration comparison against the private pre-upgrade snapshot.
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createClient, type Value } from '@libsql/client';
import { databaseConfig } from '../src/lib/database-config';

config({ override: true, quiet: true });
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
async function main() {
  const index = process.argv.indexOf('--backup');
  const path = index >= 0 ? process.argv[index + 1] : '';
  if (!path) throw new Error('Specify the private pre-migration --backup.');
  const source = databaseConfig();
  if (source.kind !== 'libsql') throw new Error('Configure the intended remote database.');
  const backup = new Database(path, { readonly: true, fileMustExist: true });
  backup.defaultSafeIntegers(true);
  const client = createClient({ url: source.url, authToken: source.authToken, intMode: 'bigint' });
  try {
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
    for (const table of ['User', 'Post', 'Reply']) {
      const columns = (backup.pragma(`table_info(${quoted(table)})`) as { name: string }[]).map(row => row.name).filter(name => table !== 'User' || name !== 'role');
      const sql = `SELECT ${columns.map(quoted).join(',')} FROM ${quoted(table)}`;
      const old = backup.prepare(sql).all() as Record<string, Value>[];
      const rows = await client.execute(sql);
      const current = new Map<string, Record<string, Value>>();
      for (const row of rows.rows) current.set(String(row.id), row);
      for (const row of old) {
        const saved = current.get(String(row.id)); assert.ok(saved);
        for (const column of columns) assert.deepEqual(saved[column], row[column]);
      }
      console.info(`PASS ${table}: all ${old.length} pre-upgrade records preserved.`);
    }
    for (const table of ['HelpRequest', 'HelpReply', 'DailyQuota', 'RoleAudit', 'AdminInvite']) await client.execute(`SELECT 1 FROM ${quoted(table)} LIMIT 1`);
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM User WHERE role = 'HELPER' AND (helperAssignedAt IS NULL OR helperAssignedById IS NULL)")).rows[0].count, BigInt(0));
    assert.equal((await client.execute('SELECT COUNT(*) AS count FROM User WHERE studyYear BETWEEN 1 AND 6 AND emailVerifiedAt IS NULL')).rows[0].count, BigInt(0));
    console.info('PASS new tables, verification backfill, appointed-only Helpers and foreign keys.');
  } finally { backup.close(); client.close(); }
}
main().catch(() => { console.error('Migration verification stopped. Inspect the private backup/schema; no private rows or credentials were logged.'); process.exitCode = 1; });
