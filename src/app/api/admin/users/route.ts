import { NextResponse } from 'next/server';
import { effectiveRole, requireUserRole } from '@/lib/auth';
import { api } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { adminUserSelection } from '@/lib/admin';
import { ApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  return api(async () => {
    const admin = await requireUserRole('ADMIN', request);
    const db = getPrisma();
    const query = new URL(request.url).searchParams;
    const search = query.get('q')?.trim() || '';
    if (search.length > 100) throw new ApiError(400, 'Member search is too long.');
    const scope = { collegeId: admin.collegeId, emailVerifiedAt: { not: null }, role: { in: ['POSTER', 'HELPER'] } };
    const before = query.get('before');
    if (before !== null && !/^[0-9a-f-]{36}$/i.test(before)) throw new ApiError(400, 'Invalid member cursor.');
    const cursor = before ? await db.user.findFirst({ where: { ...scope, id: before }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new ApiError(400, 'Member cursor is unavailable. Refresh the list.');
    const rows = await db.user.findMany({ where: { ...scope, AND: [
      ...(search ? [{ OR: [{ name: { contains: search } }, { email: { contains: search } }] }] : []),
      ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
    ] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21, select: adminUserSelection });
    const users = rows.slice(0, 20).map(user => ({ ...user, role: effectiveRole(user) }));
    return NextResponse.json({ users, nextCursor: rows.length > 20 ? users.at(-1)!.id : null });
  });
}
