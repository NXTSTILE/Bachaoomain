// Optional, read-only connectivity check. Never insert fixture data into a real database.
import 'dotenv/config';
import { getPrisma } from './src/lib/prisma';

async function main() {
  if (!process.argv.includes('--check')) throw new Error('Pass --check to query the configured database.');
  const prisma = getPrisma();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.info('Database connection succeeded. No application data was read or changed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Database check failed. Confirm configuration and connectivity; no credentials are logged.');
  process.exitCode = 1;
});
