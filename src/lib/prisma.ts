import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { databaseConfig } from './database-config';
import { unavailable } from './errors';

const globalForPrisma = globalThis as unknown as { bachaooPrisma?: PrismaClient };

// Lazy construction: importing route modules at build time never connects to a database.
export function getPrisma(): PrismaClient {
  const config = databaseConfig();
  if (globalForPrisma.bachaooPrisma) return globalForPrisma.bachaooPrisma;
  try {
    const adapter = config.kind === 'sqlite'
      ? new PrismaBetterSqlite3({ url: config.url })
      : new PrismaLibSql({ url: config.url, authToken: config.authToken });
    const client = new PrismaClient({ adapter, log: [] });
    globalForPrisma.bachaooPrisma = client;
    return client;
  } catch {
    throw unavailable('Database');
  }
}
