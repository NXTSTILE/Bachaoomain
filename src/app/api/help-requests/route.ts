import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { assertTransactionRole, requireUserRole } from '@/lib/auth';
import { api, jsonBody, text } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { POST_CATEGORIES } from '@/lib/colleges';
import { helpScope, helpSelection } from '@/lib/help';
import { reserveDailyQuota } from '@/lib/quotas';
import type { Prisma } from '@/generated/prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return api(async () => {
    const user = await requireUserRole(['POSTER', 'HELPER'], request);
    const db = getPrisma();
    const query = new URL(request.url).searchParams;
    const view = query.get('view') || 'all';
    if (!['all', 'unanswered', 'answered'].includes(view)) throw new ApiError(400, 'Invalid help view.');
    const search = query.get('q')?.trim() || '';
    if (search.length > 160) throw new ApiError(400, 'Search must be at most 160 characters.');
    const replyScope = { collegeId: user.collegeId, author: { collegeId: user.collegeId } };
    const scope = helpScope(user);
    const before = query.get('before');
    if (before !== null && !/^[0-9a-f-]{36}$/i.test(before)) throw new ApiError(400, 'Invalid help cursor.');
    const cursor = before ? await db.helpRequest.findFirst({ where: { ...scope, id: before }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new ApiError(400, 'Help cursor is unavailable. Refresh the list.');
    const where: Prisma.HelpRequestWhereInput = { ...scope, AND: [
      ...(search ? [{ OR: [{ title: { contains: search } }, { content: { contains: search } }] }] : []),
      ...(view === 'unanswered' ? [{ replies: { none: replyScope } }] : []),
      ...(view === 'answered' ? [{ replies: { some: { ...replyScope, ...(user.role === 'HELPER' ? { authorId: user.id } : {}) } } }] : []),
      ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
    ] };
    const rows = await db.helpRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21, select: helpSelection(user.collegeId) });
    const requests = rows.slice(0, 20);
    return NextResponse.json({ requests, nextCursor: rows.length > 20 ? requests.at(-1)!.id : null });
  });
}

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody(request);
    const user = await requireUserRole('POSTER', request);
    const title = text(body.title, 'Help request title', 5, 160);
    const content = text(body.content, 'Help details', 10, 5000);
    if (typeof body.category !== 'string' || !POST_CATEGORIES.some(value => value === body.category)) throw new ApiError(400, 'Choose a valid help category.');
    const category = body.category;
    const saved = await getPrisma().$transaction(async tx => {
      await assertTransactionRole(tx, user, ['POSTER']);
      await reserveDailyQuota(tx, user, 'HELP_REQUEST');
      return tx.helpRequest.create({ data: { title, content, category, authorId: user.id, collegeId: user.collegeId }, select: helpSelection(user.collegeId) });
    });
    return NextResponse.json({ request: saved }, { status: 201 });
  });
}
