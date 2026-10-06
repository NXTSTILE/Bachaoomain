import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { assertTransactionRole, requireUser, requireUserRole } from '@/lib/auth';
import { POST_CATEGORIES } from '@/lib/colleges';
import { api, jsonBody, text } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { postSelection } from '@/lib/posts';
import { reserveDailyQuota } from '@/lib/quotas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return api(async () => {
    const user = await requireUser(request);
    const db = getPrisma();
    const query = new URL(request.url).searchParams;
    const search = query.get('q')?.trim() || '';
    if (search.length > 160) throw new ApiError(400, 'Search must be at most 160 characters.');
    const category = query.get('category');
    if (category && !POST_CATEGORIES.some(value => value === category)) throw new ApiError(400, 'Choose a valid notice category.');
    const listScope = query.get('scope') || 'college';
    if (!['college', 'mine'].includes(listScope)) throw new ApiError(400, 'Choose a valid notice view.');
    const scope = { collegeId: user.collegeId, author: { collegeId: user.collegeId }, ...(listScope === 'mine' ? { authorId: user.id } : {}) };
    const before = query.get('before');
    if (before !== null && !/^[0-9a-f-]{36}$/i.test(before)) throw new ApiError(400, 'Invalid notice cursor.');
    const cursor = before ? await db.post.findFirst({ where: { ...scope, id: before }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new ApiError(400, 'Notice cursor is unavailable. Refresh the board.');
    const rows = await db.post.findMany({
      where: { ...scope, ...(category ? { category } : {}), AND: [
        ...(search ? [{ OR: [{ title: { contains: search } }, { content: { contains: search } }] }] : []),
        ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
      ] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
      select: postSelection(user.collegeId),
    });
    const posts = rows.slice(0, 30);
    return NextResponse.json({ posts, nextCursor: rows.length > 30 ? posts.at(-1)!.id : null });
  });
}

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody(request);
    const user = await requireUserRole('POSTER', request);
    const title = text(body.title, 'Title', 5, 160);
    const content = text(body.content, 'Notice message', 10, 5000);
    if (typeof body.category !== 'string' || !POST_CATEGORIES.some((category) => category === body.category)) {
      throw new ApiError(400, 'Choose a valid notice category.');
    }
    const category = body.category;
    const post = await getPrisma().$transaction(async tx => {
      await assertTransactionRole(tx, user, ['POSTER']);
      await reserveDailyQuota(tx, user, 'NOTICE_BOARD');
      return tx.post.create({
        data: { title, content, category, collegeId: user.collegeId, authorId: user.id },
        select: postSelection(user.collegeId),
      });
    });
    return NextResponse.json({ post }, { status: 201 });
  });
}
