import { redirect } from 'next/navigation';
import { requireUser } from './auth';
import { ApiError } from './errors';
import type { Role } from './colleges';

export async function pageMember(roles?: Role[]) {
  let member;
  try { member = await requireUser(); } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) redirect('/login');
    throw error;
  }
  if (roles && !roles.includes(member.role)) redirect(member.role === 'ADMIN' ? '/superadmin' : member.role === 'HELPER' ? '/helper' : '/poster');
  return member;
}
