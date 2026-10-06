// Send private configuration to Vercel via stdin; values never enter CLI arguments.
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import { databaseConfig } from '../src/lib/database-config';
import { deploymentChecks } from '../src/lib/deployment';

config({ override: true, quiet: true });

async function main() {
  const target = process.argv.find(value => value === 'preview' || value === 'production');
  if (!target) throw new Error('Specify preview or production.');
  const database = databaseConfig();
  if (database.kind !== 'libsql') throw new Error('Hosted deployment requires libSQL.');
  const open = process.argv.includes('--open');
  const databaseOnly = process.argv.includes('--database-only');
  if (open && databaseOnly) throw new Error('Cannot open onboarding without email settings.');
  const env: Record<string, string> = {
    TURSO_DATABASE_URL: database.url,
    TURSO_AUTH_TOKEN: database.authToken,
    JWT_SECRET: process.env.JWT_SECRET || '',
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || '',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '',
    REGISTRATION_OPEN: open ? 'true' : 'false',
  };
  if (!databaseOnly) {
    env.BREVO_API_KEY = process.env.BREVO_API_KEY || '';
    env.BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';
  }
  const checks = deploymentChecks({ ...env, NODE_ENV: 'production', VERCEL: '1' });
  for (const key of ['database', 'sessionSecret', 'supportContact', 'publicOrigin'] as const) {
    if (!checks[key]) throw new Error(`Missing ${key} configuration.`);
  }
  if (!databaseOnly && !checks.email) throw new Error('Email configuration is missing.');
  const sensitive = new Set(['TURSO_AUTH_TOKEN', 'JWT_SECRET', 'BREVO_API_KEY']);
  for (const [key, value] of Object.entries(env)) {
    await new Promise<void>((resolve, reject) => {
      // An explicit empty preview branch prevents the CLI from consuming secret
      // stdin as an answer to its otherwise interactive branch prompt.
      const args = ['env', 'add', key, target, ...(target === 'preview' ? [''] : []), '--force', '--yes', sensitive.has(key) ? '--sensitive' : '--no-sensitive'];
      const child = spawn('vercel', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', chunk => { output += String(chunk); });
      child.stderr.on('data', chunk => { output += String(chunk); });
      child.once('error', () => reject(new Error(`Unable to configure ${key}.`)));
      child.once('exit', code => code === 0 && /(?:Added|Overrode) Environment Variable/.test(output) ? resolve() : reject(new Error(`Vercel did not save ${key}.`)));
      child.stdin.on('error', () => { /* The exit handler reports CLI failure without the value. */ });
      child.stdin.end(value);
    });
    console.info(`Configured ${key} (${target}).`);
  }
  console.info(`Vercel ${target} configuration saved. Redeploy for settings to take effect.`);
}

main().catch(() => {
  console.error('Vercel configuration stopped. Check CLI account/project access and configuration. No secret values are logged.');
  process.exitCode = 1;
});
