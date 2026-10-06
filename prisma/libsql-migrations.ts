import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Client } from '@libsql/client';

// Explicit operator workflow for Turso: Prisma's SQLite migrate CLI does not speak
// the remote libSQL protocol. Keep the standard Prisma migration history/checksums.
export async function applyLibsqlMigrations(client: Client, directory: string): Promise<string[]> {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
    .map((entry) => entry.name).sort();
  const applied: string[] = [];
  for (const name of names) {
    const sql = await readFile(join(directory, name, 'migration.sql'), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const tx = await client.transaction('write');
    try {
      await tx.execute(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY, "checksum" TEXT NOT NULL,
        "finished_at" DATETIME, "migration_name" TEXT NOT NULL, "logs" TEXT,
        "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`);
      const previous = await tx.execute({
        sql: 'SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name = ? AND rolled_back_at IS NULL', args: [name],
      });
      if (previous.rows.length) {
        if (previous.rows.some((row) => row.checksum !== checksum || row.finished_at == null)) {
          throw new Error('Migration history mismatch or unresolved failed migration. Stop and inspect the database backup/history.');
        }
      } else {
        await tx.executeMultiple(sql);
        await tx.execute({
          sql: 'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)',
          args: [randomUUID(), checksum, name],
        });
        applied.push(name);
      }
      await tx.commit();
    } finally {
      if (!tx.closed) await tx.rollback();
      tx.close();
    }
  }
  return applied;
}
