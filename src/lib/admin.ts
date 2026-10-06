import { assertTransactionRole, effectiveRole, validMembership, type Member } from './auth';
import { getPrisma } from './prisma';
import { ApiError } from './errors';

export const adminUserSelection = { id: true, name: true, email: true, role: true, collegeId: true, studyYear: true, createdAt: true, emailVerifiedAt: true, helperAssignedAt: true, helperAssignedById: true } as const;

export async function appointHelper(admin: Member, id: string, enabled: boolean, expectedRole?: string) {
  return getPrisma().$transaction(async tx => {
    await assertTransactionRole(tx, admin, ['ADMIN']);
    const target = await tx.user.findFirst({ where: { id, collegeId: admin.collegeId }, select: adminUserSelection });
    if (!target) throw new ApiError(404, 'Member not found.');
    if (!validMembership(target) || !['POSTER', 'HELPER'].includes(target.role)) throw new ApiError(403, 'Only verified Poster/Helper accounts can be appointed.');
    const previous = effectiveRole(target);
    if (expectedRole && previous !== expectedRole) throw new ApiError(409, 'This member’s role changed. Refresh the list and try again.');
    const role = enabled ? 'HELPER' : 'POSTER';
    if (role === previous) return { user: { ...target, role: previous }, changed: false };
    const changed = await tx.user.updateMany({ where: { id, collegeId: admin.collegeId, role: target.role },
      data: { role, helperAssignedAt: enabled ? new Date() : null, helperAssignedById: enabled ? admin.id : null },
    });
    if (changed.count !== 1) throw new ApiError(409, 'This member’s role changed. Refresh the list.');
    await tx.roleAudit.create({ data: { actorId: admin.id, targetId: id, collegeId: admin.collegeId, oldRole: previous, newRole: role, action: enabled ? 'ASSIGN_HELPER' : 'REVOKE_HELPER' } });
    return { user: await tx.user.findUniqueOrThrow({ where: { id }, select: adminUserSelection }), changed: true };
  });
}

// Private operator workflow only. Re-read verification and role inside the write transaction.
export async function provisionVerifiedAdmin(email: string, collegeId: string) {
  return getPrisma().$transaction(async tx => {
    const account = await tx.user.findUnique({ where: { email } });
    if (!account || account.collegeId !== collegeId || !validMembership(account) || !['POSTER', 'HELPER', 'ADMIN'].includes(account.role)) throw new ApiError(403, 'The existing account is not verified for this college.');
    if (account.role === 'ADMIN') return false;
    await tx.user.update({ where: { id: account.id }, data: { role: 'ADMIN', helperAssignedAt: null, helperAssignedById: null } });
    await tx.roleAudit.create({ data: { actorId: account.id, targetId: account.id, collegeId, oldRole: effectiveRole(account), newRole: 'ADMIN', action: 'OPERATOR_ADMIN_PROVISION' } });
    return true;
  });
}
