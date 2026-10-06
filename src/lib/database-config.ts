import { unavailable } from './errors';

type Environment = Record<string, string | undefined>;
export type DatabaseConfig = { kind: 'sqlite'; url: string } | { kind: 'libsql'; url: string; authToken: string };

export function databaseConfig(env: Environment = process.env): DatabaseConfig {
  const url = env.TURSO_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!url) throw unavailable('Database');
  if (url.startsWith('file:')) {
    // Vercel's filesystem is ephemeral and cannot serve as a shared database.
    if (env.VERCEL === '1' || env.VERCEL_ENV || url.length <= 5) throw unavailable('Database');
    return { kind: 'sqlite', url };
  }
  try {
    const parsed = new URL(url);
    if (!['libsql:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('Invalid remote database URL');
    }
    const authToken = env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken) throw new Error('Missing remote database token');
    return { kind: 'libsql', url, authToken };
  } catch {
    throw unavailable('Database');
  }
}
