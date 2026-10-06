import 'dotenv/config';
import { createClient } from '@libsql/client';
import { databaseConfig } from '../src/lib/database-config';
import { emailConfig } from '../src/lib/email';

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{1,60}$/.test(error.code)) return error.code;
  return 'UNKNOWN';
}

async function main() {
  const config = databaseConfig();
  if (config.kind !== 'libsql') throw new Error('Remote libSQL configuration is required.');
  const client = createClient({ url: config.url, authToken: config.authToken });
  try {
    await client.execute('SELECT 1');
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    console.info('PASS remote database connectivity');
    console.info(`Non-system tables: ${tables.rows.length}`);
    if (tables.rows.length) {
      const known = new Set(tables.rows.map(row => String(row.name)));
      for (const table of ['User', 'Post', 'Reply', 'Otp', 'RateLimit', 'HelpRequest', 'HelpReply', 'DailyQuota', 'RoleAudit', 'AdminInvite', '_prisma_migrations']) console.info(`${known.has(table) ? 'PRESENT' : 'ABSENT'} ${table}`);
      if (known.has('_prisma_migrations')) {
        const history = await client.execute('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations');
        console.info(`Migration history entries: ${history.rows.length}`);
        console.info(`Unresolved migration entries: ${history.rows.filter(row => !row.finished_at && !row.rolled_back_at).length}`);
      }
    }
  } catch (error) {
    console.error(`Database preflight failed (${errorCode(error)}).`);
    process.exitCode = 1;
  } finally { client.close(); }

  const mail = emailConfig();
  console.info(`Brevo API key format: ${mail.apiKey.startsWith('xkeysib-') ? 'recognized' : 'unrecognized'}`);
  const response = await fetch('https://api.brevo.com/v3/senders', {
    headers: { Accept: 'application/json', 'api-key': mail.apiKey },
    signal: AbortSignal.timeout(15000), cache: 'no-store',
  });
  if (!response.ok) {
    console.error(`Email provider check failed (HTTP ${response.status}).`);
    const data = await response.json().catch(() => null) as { message?: unknown } | null;
    if (typeof data?.message === 'string') {
      const message = data.message.toLowerCase();
      if (/\bip\b|ip address/.test(message)) console.error('Provider reports an IP-access restriction. Check Brevo authorized-IP settings.');
      else if (message.includes('not found') || message.includes('invalid')) console.error('Provider does not recognize the configured API key.');
      else if (message.includes('disabled') || message.includes('deactivated')) console.error('Provider reports a disabled API key/account.');
      else console.error('Provider refused authentication. No raw provider response is logged.');
    }
    process.exitCode = 1;
    return;
  }
  const data = await response.json() as { senders?: { email?: string; active?: boolean }[] };
  const sender = data.senders?.find(entry => entry.email?.toLowerCase() === mail.senderEmail.toLowerCase());
  if (!sender?.active) {
    console.error('Configured sender is not verified/active in the Brevo account.');
    process.exitCode = 1;
  } else {
    console.info('PASS email provider credentials and active sender');
  }
  // No email is sent and no provider response/private row is logged.
}

main().catch(() => {
  console.error('Service preflight failed. No credentials or private response payloads are logged.');
  process.exitCode = 1;
});
