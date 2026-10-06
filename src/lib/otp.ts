import { createHmac, timingSafeEqual } from 'node:crypto';
import { signingKey } from './session';

export const OTP_LIFETIME_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

// A keyed digest prevents six-digit codes being recovered by an offline DB-only attack.
export function otpDigest(id: string, email: string, code: string): string {
  return createHmac('sha256', signingKey()).update(`otp:${id}:${email}:${code}`).digest('hex');
}

export function matchesOtp(id: string, email: string, code: string, digest: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(digest)) return false;
  return timingSafeEqual(Buffer.from(otpDigest(id, email, code), 'hex'), Buffer.from(digest, 'hex'));
}
