import { randomInt, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { emailConfig, sendOTP } from '@/lib/email';
import { collegeEmail } from '@/lib/colleges';
import { api, jsonBody } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { cleanExpiredAuthRecords, consumeRateLimit, requestIdentity } from '@/lib/rate-limit';
import { OTP_LIFETIME_MS, OTP_MAX_ATTEMPTS, otpDigest } from '@/lib/otp';
import { requireRegistrationOpen } from '@/lib/deployment';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody(request);
    requireRegistrationOpen();
    const { email } = collegeEmail(body.email);
    emailConfig();
    // Campus Wi-Fi can put hundreds of students behind one public address.
    // The strict per-email and resend limits below remain the primary controls.
    await consumeRateLimit('register-ip', requestIdentity(request), 300, 3600);
    const db = getPrisma();
    try {
      await consumeRateLimit('register-email', email, 3, 3600);
      await consumeRateLimit('register-resend', email, 1, 60);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const pending = await db.otp.findUnique({ where: { email }, select: { delivered: true, expiresAt: true, attempts: true } });
        if (pending?.delivered && pending.expiresAt > new Date() && pending.attempts < OTP_MAX_ATTEMPTS) {
          return NextResponse.json({
            error: 'A verification code has already been sent. Use the code in your newest email.',
            useExistingCode: true,
            retryAfter: error.retryAfter,
          }, { status: 429, headers: { 'Retry-After': String(error.retryAfter || 60) } });
        }
      }
      throw error;
    }
    await cleanExpiredAuthRecords();
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ApiError(409, 'This email is already registered. Please sign in.');
    }
    const id = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const data = { id, digest: otpDigest(id, email, code), attempts: 0, delivered: false, expiresAt: new Date(Date.now() + OTP_LIFETIME_MS), createdAt: new Date() };
    await db.otp.upsert({ where: { email }, create: { ...data, email }, update: data });
    try {
      await sendOTP(email, code);
      await db.otp.updateMany({ where: { id }, data: { delivered: true } });
    } catch (error) {
      // Do not erase a newer resend if a slow provider request finishes later.
      await db.otp.deleteMany({ where: { id } });
      throw error;
    }
    return NextResponse.json({ message: 'Verification code sent. It expires in 10 minutes.' });
  });
}
