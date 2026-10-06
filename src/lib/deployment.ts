import { databaseConfig } from './database-config';
import { ApiError } from './errors';

type Environment = Record<string, string | undefined>;
const emailPattern = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function supportEmail(env: Environment = process.env): string | null {
  const email = env.SUPPORT_EMAIL?.trim();
  return email && emailPattern.test(email) ? email : null;
}

export function deploymentChecks(env: Environment = process.env) {
  let database = false;
  try { databaseConfig(env); database = true; } catch { /* Report readiness without logging configuration. */ }
  let publicOrigin = false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SITE_URL || `https://${env.VERCEL_PROJECT_PRODUCTION_URL || ''}`);
    publicOrigin = url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch { /* An unset/invalid origin is not launch-ready. */ }
  return {
    database,
    sessionSecret: (env.JWT_SECRET?.trim().length || 0) >= 32,
    email: Boolean(env.BREVO_API_KEY?.trim() && emailPattern.test(env.BREVO_SENDER_EMAIL?.trim() || '')),
    supportContact: supportEmail(env) !== null,
    publicOrigin,
    registrationEnabled: env.REGISTRATION_OPEN === 'true',
  };
}

function production(env: Environment) {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL || env.VERCEL_ENV);
}

export function registrationAvailable(env: Environment = process.env): boolean {
  if (!production(env)) return env.REGISTRATION_OPEN !== 'false';
  return Object.values(deploymentChecks(env)).every(Boolean);
}

export function loginAvailable(env: Environment = process.env): boolean {
  if (!production(env)) return true;
  const checks = deploymentChecks(env);
  // Pausing new registrations or an email outage must not lock existing members out.
  return checks.database && checks.sessionSecret;
}

export function requireRegistrationOpen(): void {
  if (!registrationAvailable()) throw new ApiError(503, 'New registrations are not open yet. Please check back when the campus pilot opens.');
}
