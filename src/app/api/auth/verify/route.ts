import bcrypt from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';
import { sessionResponse } from '@/lib/auth';
import { collegeEmail } from '@/lib/colleges';
import { api, jsonBody, passwordInput, text } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { consumeRateLimit, requestIdentity } from '@/lib/rate-limit';
import { matchesOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp';
import { requireRegistrationOpen } from '@/lib/deployment';
import { signingKey } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody(request);
    requireRegistrationOpen();
    const { email, collegeId } = collegeEmail(body.email);
    const fullName = text(body.fullName, 'Full name', 2, 80);
    const password = passwordInput(body.password, true);
    if (body.role !== undefined && body.role !== 'POSTER') throw new ApiError(400, 'Signup creates a Poster account. Helpers are appointed by an Admin.');
    const role = 'POSTER' as const;
    if (typeof body.studyYear !== 'number' || !Number.isInteger(body.studyYear) || body.studyYear < 1 || body.studyYear > 6) {
      throw new ApiError(400, 'Study year must be an integer from 1 to 6.');
    }
    const studyYear = body.studyYear;
    if (typeof body.otp !== 'string' || !/^\d{6}$/.test(body.otp)) throw new ApiError(400, 'Enter the six-digit verification code.');
    // A configuration outage must not consume a code attempt or create an account without a session.
    signingKey();
    await consumeRateLimit('verify-ip', requestIdentity(request), 300, 600);
    await consumeRateLimit('verify-email', email, 10, 600);
    const db = getPrisma();
    const record = await db.otp.findUnique({ where: { email } });
    if (!record || !record.delivered || record.expiresAt <= new Date()) throw new ApiError(400, 'Invalid or expired verification code. Request a new code.');
    if (record.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, 'Too many incorrect codes. Request a new code.', 60);
    // Reserve an attempt before comparing. Failed attempts must survive transaction rollback.
    const reserved = await db.otp.updateMany({
      where: { id: record.id, delivered: true, attempts: { lt: OTP_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    if (!reserved.count || !matchesOtp(record.id, email, body.otp, record.digest)) throw new ApiError(400, 'Invalid or expired verification code.');
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.$transaction(async (tx) => {
      // Consume the exact challenge and create the account atomically (including races/resends).
      const consumed = await tx.otp.deleteMany({ where: { id: record.id, digest: record.digest, delivered: true, expiresAt: { gt: new Date() } } });
      if (consumed.count !== 1) throw new ApiError(400, 'This verification code is no longer valid.');
      return tx.user.create({ data: { email, collegeId, name: fullName, password: hashedPassword, role, studyYear, emailVerifiedAt: new Date() } });
    });
    return sessionResponse({ id: user.id, role });
  });
}
