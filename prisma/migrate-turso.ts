import 'dotenv/config';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { databaseConfig } from '../src/lib/database-config';
import { applyLibsqlMigrations } from './libsql-migrations';

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Run with --apply only after backing up and confirming the target database.');
  const config = databaseConfig();
  if (config.kind !== 'libsql') throw new Error('The Turso migration command requires a remote libSQL database.');
  const client = createClient({ url: config.url, authToken: config.authToken });
  try {
    const applied = await applyLibsqlMigrations(client, resolve('prisma/migrations'));
    console.info(`Applied ${applied.length} migration(s).`);
  } finally {
    client.close();
  }
}

main().catch(() => {
  // Do not print driver errors: they may contain connection credentials or SQL data.
  console.error('Migration stopped. Check configuration, backups, connectivity, and migration history before retrying. No automatic reset was attempted.');
  process.exitCode = 1;
});
