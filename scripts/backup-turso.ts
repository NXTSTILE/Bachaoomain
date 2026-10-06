// Read-only remote snapshot, with an optional migration rehearsal on a separate local copy.
// Backup files contain private data; create them outside the checkout with owner-only permissions.
import { config } from 'dotenv';
import { openSync, closeSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createClient, type Value } from '@libsql/client';
import { databaseConfig } from '../src/lib/database-config';
import { applyLibsqlMigrations } from '../prisma/libsql-migrations';

config({ override: true, quiet: true });
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
const sqliteValue = (value: Value) => value instanceof ArrayBuffer ? Buffer.from(value) : value;

async function main() {
  const index = process.argv.indexOf('--output');
  const output = index >= 0 ? process.argv[index + 1] : '';
  if (!output || !isAbsolute(output) || !output.endsWith('.db')) throw new Error('Specify an absolute, private --output path ending in .db.');
  const source = databaseConfig();
  if (source.kind !== 'libsql') throw new Error('Configure the intended remote libSQL database.');
  const client = createClient({ url: source.url, authToken: source.authToken, intMode: 'bigint' });
  const file = openSync(output, 'wx', 0o600); closeSync(file); // Refuse overwrites.
  const backup = new Database(output);
  let rowsCopied = 0;
  try {
    const tx = await client.transaction('read');
    try {
      const schema = await tx.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
      const tables = schema.rows.filter(row => row.type === 'table');
      assert.ok(tables.some(row => row.name === 'User'), 'Expected Bachaoo schema');
      backup.pragma('foreign_keys = OFF'); backup.exec('BEGIN');
      for (const table of tables) backup.exec(String(table.sql));
      for (const table of tables) {
        const result = await tx.execute(`SELECT * FROM ${quoted(String(table.name))}`);
        if (!result.rows.length) continue;
        const insert = backup.prepare(`INSERT INTO ${quoted(String(table.name))} (${result.columns.map(quoted).join(',')}) VALUES (${result.columns.map(() => '?').join(',')})`);
        for (const row of result.rows) insert.run(...result.columns.map(column => sqliteValue(row[column])));
        rowsCopied += result.rows.length;
        const actual = backup.prepare(`SELECT COUNT(*) AS count FROM ${quoted(String(table.name))}`).get() as { count: number };
        assert.equal(actual.count, result.rows.length);
      }
      for (const row of schema.rows.filter(row => row.type !== 'table')) backup.exec(String(row.sql));
      backup.exec('COMMIT'); backup.pragma('foreign_keys = ON');
      assert.equal(backup.pragma('integrity_check', { simple: true }), 'ok');
      assert.deepEqual(backup.pragma('foreign_key_check'), []);
      await tx.commit();
      console.info(`PASS consistent remote snapshot: ${tables.length} tables, ${rowsCopied} rows, integrity and foreign keys verified.`);
    } finally { if (!tx.closed) await tx.rollback(); tx.close(); }
    console.info(`Private backup: ${output}`);
    if (process.argv.includes('--rehearse')) {
      const rehearsal = output.replace(/\.db$/, '-rehearsal.db');
      const fd = openSync(rehearsal, 'wx', 0o600); closeSync(fd);
      await backup.backup(rehearsal);
      const clone = createClient({ url: `file:${rehearsal}`, intMode: 'bigint' });
      try {
        const existing = new Map<string, string>();
        for (const table of ['User', 'Post', 'Reply']) {
          // Compare every old column and value; added columns and intentional role changes are excluded.
          const columns = (backup.pragma(`table_info(${quoted(table)})`) as { name: string }[]).map(row => row.name).filter(name => table !== 'User' || name !== 'role');
          const sql = `SELECT ${columns.map(quoted).join(',')} FROM ${quoted(table)} ORDER BY id`;
          existing.set(sql, JSON.stringify((await clone.execute(sql)).rows, (_, value) => typeof value === 'bigint' ? value.toString() : value));
        }
        const applied = await applyLibsqlMigrations(clone, 'prisma/migrations');
        for (const [sql, expected] of existing) assert.equal(JSON.stringify((await clone.execute(sql)).rows, (_, value) => typeof value === 'bigint' ? value.toString() : value), expected);
        assert.equal((await clone.execute('PRAGMA foreign_key_check')).rows.length, 0);
        assert.equal((await clone.execute("SELECT COUNT(*) AS count FROM User WHERE role = 'HELPER' AND (helperAssignedAt IS NULL OR helperAssignedById IS NULL)")).rows[0].count, BigInt(0));
        console.info(`PASS local restore/migration rehearsal: ${applied.length} pending migrations; existing account/content fields preserved.`);
        console.info(`Private rehearsal copy: ${rehearsal}`);
      } finally { clone.close(); }
    }
  } finally { backup.close(); client.close(); }
}

main().catch(() => { console.error('Backup/rehearsal stopped. Inspect the private snapshot and configuration; no private rows or credentials were logged.'); process.exitCode = 1; });
