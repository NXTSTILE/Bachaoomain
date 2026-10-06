// Operator diagnostics for a single explicitly supplied signup-test mailbox.
// Never prints credentials, codes, hashes, session tokens, or private records.
import { config } from 'dotenv';
import { getPrisma } from '../src/lib/prisma';
import { collegeEmail } from '../src/lib/colleges';
import { rateKey } from '../src/lib/rate-limit';
import { OTP_MAX_ATTEMPTS } from '../src/lib/otp';

config({ override: true, quiet: true });

async function main() {
  const argument = process.argv.find(value => value.includes('@'));
  const { email } = collegeEmail(argument);
  const db = getPrisma();
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    const challenge = await db.otp.findUnique({ where: { email }, select: { delivered: true, expiresAt: true, attempts: true } });
    const liveChallenge = Boolean(challenge?.delivered && challenge.expiresAt > new Date() && challenge.attempts < OTP_MAX_ATTEMPTS);
    console.info(`Registered account: ${Boolean(user)}`);
    console.info(`Usable verification challenge: ${liveChallenge}`);
    if (challenge) console.info(`Verification attempts used: ${challenge.attempts}; code lifetime remaining: ${Math.max(0, Math.ceil((challenge.expiresAt.getTime() - Date.now()) / 1000))} seconds.`);
    if (user) console.info(`Current role: ${user.role}`);
    const keys = ['register-email', 'register-resend'].map(scope => rateKey(scope, email));
    if (process.argv.includes('--release-failed-delivery-budget')) {
      // A provider outage consumed this one mailbox's request budget without
      // sending any usable code. Keep all OTP attempts and other users' limits.
      if (user || liveChallenge) throw new Error('Cannot release a budget for an account or live verification challenge.');
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
      console.info('Released only this signup-test mailbox’s failed-delivery request budget.');
    }
    const limits = await db.rateLimit.findMany({ where: { key: { in: keys } }, select: { count: true, expiresAt: true } });
    for (const limit of limits) {
      console.info(`Signup request counter: ${limit.count}; expires in ${Math.max(0, Math.ceil((Number(limit.expiresAt) - Date.now()) / 1000))} seconds.`);
    }
  } finally { await db.$disconnect(); }
}

main().catch(() => {
  console.error('Pilot diagnostic stopped. No private records or credentials were printed.');
  process.exitCode = 1;
});
