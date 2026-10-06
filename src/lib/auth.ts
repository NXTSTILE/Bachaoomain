import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPrisma } from './prisma';
import { COLLEGES, collegeEmail, isRole, type Role } from './colleges';
import type { Prisma } from '../generated/prisma/client';
import { ApiError } from './errors';
import { SESSION_COOKIE, issueSessionToken, sessionCookieOptions, verifySessionToken, type Session } from './session';

export const publicAuthor = { id: true, name: true, role: true, studyYear: true } as const;
export const publicUser = { ...publicAuthor, collegeId: true } as const;

export function effectiveRole(user: { role: string; helperAssignedAt: Date | null; helperAssignedById: string | null }): Role {
  if (!isRole(user.role)) throw new ApiError(401, 'Please sign in again.');
  return user.role === 'HELPER' && (!user.helperAssignedAt || !user.helperAssignedById) ? 'POSTER' : user.role;
}

export function validMembership(user: { email: string; collegeId: string; role: string; emailVerifiedAt: Date | null }) {
  if (!user.emailVerifiedAt) return false;
  if (user.role === 'ADMIN') return COLLEGES.some(college => college.id === user.collegeId);
  try { return collegeEmail(user.email).collegeId === user.collegeId; } catch { return false; }
}

export async function getSession(request?: Request): Promise<Session | null> {
  const token = request
    ? request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
    : (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

// JWTs provide identity only. Membership and permissions always come from a fresh DB record.
export async function requireUser(request?: Request) {
  const session = await getSession(request);
  if (!session) throw new ApiError(401, 'Please sign in to continue.');
  const user = await getPrisma().user.findUnique({ where: { id: session.id }, select: { ...publicUser, email: true, emailVerifiedAt: true, helperAssignedAt: true, helperAssignedById: true } });
  if (!user || !isRole(user.role)) throw new ApiError(401, 'Please sign in again.');
  if (!validMembership(user)) {
    throw new ApiError(403, 'Your college membership is not supported.');
  }
  return { id: user.id, name: user.name, studyYear: user.studyYear, collegeId: user.collegeId, role: effectiveRole(user) };
}

export type Member = Awaited<ReturnType<typeof requireUser>>;

// Recheck mutation permissions inside the same transaction as the write.
export async function assertTransactionRole(tx: Prisma.TransactionClient, member: Member, roles: Role[]) {
  const current = await tx.user.findUnique({ where: { id: member.id } });
  if (!current || current.collegeId !== member.collegeId || !validMembership(current)) throw new ApiError(403, 'Your membership changed. Please sign in again.');
  if (!roles.includes(effectiveRole(current))) throw new ApiError(403, 'You do not have permission for this action.');
}

export async function requireUserRole(roles: Role | Role[], request?: Request) {
  const user = await requireUser(request);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) throw new ApiError(403, 'You do not have access to this dashboard.');
  return user;
}

export async function sessionResponse(session: Session): Promise<NextResponse> {
  const response = NextResponse.json({ redirectTo: session.role === 'POSTER' ? '/poster' : session.role === 'HELPER' ? '/helper' : '/superadmin' });
  response.cookies.set(SESSION_COOKIE, await issueSessionToken(session), sessionCookieOptions());
  return response;
}
