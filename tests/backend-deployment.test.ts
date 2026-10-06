import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentChecks, loginAvailable, registrationAvailable, supportEmail } from '../src/lib/deployment';
import { POST as register } from '../src/app/api/auth/register/route';
import { POST as verify } from '../src/app/api/auth/verify/route';

const configured = {
  NODE_ENV: 'production', VERCEL: '1', DATABASE_URL: 'libsql://fixture.turso.io',
  TURSO_AUTH_TOKEN: 'fixture', JWT_SECRET: 'isolated-deployment-tests-not-a-real-secret',
  BREVO_API_KEY: 'fixture', BREVO_SENDER_EMAIL: 'sender@example.invalid',
  SUPPORT_EMAIL: 'support@example.invalid', NEXT_PUBLIC_SITE_URL: 'https://fixture.example.invalid',
  REGISTRATION_OPEN: 'true',
};

test('production onboarding fails closed unless every requirement and explicit switch is present', () => {
  assert.equal(registrationAvailable(configured), true);
  for (const key of Object.keys(configured).filter(key => !['NODE_ENV', 'VERCEL'].includes(key))) {
    assert.equal(registrationAvailable({ ...configured, [key]: '' }), false, key);
  }
  assert.equal(registrationAvailable({ ...configured, DATABASE_URL: 'file:./dev.db' }), false);
  assert.equal(registrationAvailable({ ...configured, JWT_SECRET: ' '.repeat(40) }), false);
  assert.equal(registrationAvailable({ ...configured, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }), false);
  assert.equal(registrationAvailable({ ...configured, NEXT_PUBLIC_SITE_URL: 'https://user:password@example.invalid' }), false);
  assert.equal(registrationAvailable({ ...configured, REGISTRATION_OPEN: 'false' }), false);
  assert.equal(registrationAvailable({ NODE_ENV: 'development' }), true);
  assert.equal(registrationAvailable({ NODE_ENV: 'development', REGISTRATION_OPEN: 'false' }), false);
  assert.equal(deploymentChecks({ ...configured, NEXT_PUBLIC_SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'fixture.vercel.app' }).publicOrigin, true);
});

test('existing members can log in while registrations are paused or email is unavailable', () => {
  assert.equal(loginAvailable({ ...configured, REGISTRATION_OPEN: 'false', BREVO_API_KEY: '', SUPPORT_EMAIL: '' }), true);
  assert.equal(loginAvailable({ ...configured, TURSO_AUTH_TOKEN: '' }), false);
  assert.equal(loginAvailable({ ...configured, JWT_SECRET: '' }), false);
});

test('support addresses reject header injection and mailto query manipulation', () => {
  assert.equal(supportEmail({ SUPPORT_EMAIL: ' help@example.invalid ' }), 'help@example.invalid');
  for (const value of ['', 'not-an-email', 'help@example.invalid?subject=bad', 'help@example.invalid\r\nBcc:x@example.invalid']) assert.equal(supportEmail({ SUPPORT_EMAIL: value }), null);
});

test('closed registration cannot be bypassed by posting directly to register or verify', async () => {
  const keys = ['REGISTRATION_OPEN', 'DATABASE_URL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'BREVO_API_KEY'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  // A regression must never fall through to inherited real services.
  for (const key of keys) process.env[key] = '';
  process.env.REGISTRATION_OPEN = 'false';
  try {
    for (const [path, handler] of [['register', register], ['verify', verify]] as const) {
      const response = await handler(new Request(`http://localhost:3000/api/auth/${path}`, { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '123456789012@cutm.ac.in' }) }));
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /registrations are not open/);
    }
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
