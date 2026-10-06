import bcrypt from 'bcryptjs';
import { api, jsonBody, passwordInput, text } from '@/lib/http';
import { sessionResponse } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { invitationDigest } from '@/lib/admin-invite';
import { ApiError } from '@/lib/errors';
import { consumeRateLimit, requestIdentity } from '@/lib/rate-limit';
import { signingKey } from '@/lib/session';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody(request);
    signingKey(); // A missing session configuration must not consume the invitation.
    const name = text(body.name, 'Display name', 2, 80);
    const password = passwordInput(body.password, true);
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new ApiError(400, 'Open the Admin invitation from your email.');
    await consumeRateLimit('admin-invite-ip', requestIdentity(request), 20, 3600);
    const digest = invitationDigest(body.token);
    await consumeRateLimit('admin-invite-token', digest, 5, 3600);
    const db = getPrisma();
    const invitation = await db.adminInvite.findUnique({ where: { digest } });
    if (!invitation?.delivered || invitation.expiresAt <= new Date()) throw new ApiError(400, 'This Admin invitation is invalid or expired. Ask the operator for a new invitation.');
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.$transaction(async tx => {
      const consumed = await tx.adminInvite.deleteMany({ where: { id: invitation.id, digest, delivered: true, expiresAt: { gt: new Date() } } });
      if (consumed.count !== 1) throw new ApiError(400, 'This Admin invitation has already been used.');
      const account = await tx.user.create({ data: { email: invitation.email, name, password: hashedPassword, collegeId: invitation.collegeId, role: 'ADMIN', emailVerifiedAt: new Date() } });
      await tx.roleAudit.create({ data: { actorId: account.id, targetId: account.id, collegeId: account.collegeId, oldRole: 'NONE', newRole: 'ADMIN', action: 'ADMIN_INVITE_ACCEPTED' } });
      return account;
    });
    return sessionResponse({ id: user.id, role: 'ADMIN' });
  });
}
