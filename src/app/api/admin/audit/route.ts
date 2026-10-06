import { NextResponse } from 'next/server';
import { requireUserRole } from '@/lib/auth';
import { api } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  return api(async () => {
    const admin = await requireUserRole('ADMIN', request);
    const entries = await getPrisma().roleAudit.findMany({ where: { collegeId: admin.collegeId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
      select: { id: true, action: true, oldRole: true, newRole: true, createdAt: true, actor: { select: { name: true } }, target: { select: { name: true } } },
    });
    return NextResponse.json({ entries });
  });
}
