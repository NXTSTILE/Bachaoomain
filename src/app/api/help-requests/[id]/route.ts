import { NextResponse } from 'next/server';
import { requireUserRole } from '@/lib/auth';
import { api } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { helpScope, helpSelection } from '@/lib/help';
import { ApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUserRole(['POSTER', 'HELPER'], request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Help request not found.');
    const item = await getPrisma().helpRequest.findFirst({ where: { ...helpScope(user), id }, select: helpSelection(user.collegeId) });
    if (!item) throw new ApiError(404, 'Help request not found.');
    return NextResponse.json({ request: item });
  });
}
