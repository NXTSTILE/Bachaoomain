import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { assertTransactionRole, publicAuthor, requireUser } from '@/lib/auth';
import { api, jsonBody, text } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { consumeRateLimit } from '@/lib/rate-limit';
import { REPLY_PAGE_LIMIT, replySelection } from '@/lib/posts';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser(request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Question not found.');
    const db = getPrisma();
    const post = await db.post.findFirst({ where: { id, collegeId: user.collegeId, author: { collegeId: user.collegeId } }, select: { id: true } });
    if (!post) throw new ApiError(404, 'Question not found.');
    const before = new URL(request.url).searchParams.get('before');
    const scope = { postId: id, collegeId: user.collegeId, author: { collegeId: user.collegeId } };
    if (before !== null && !/^[0-9a-f-]{36}$/i.test(before)) throw new ApiError(400, 'Invalid reply cursor.');
    const cursor = before ? await db.reply.findFirst({ where: { ...scope, id: before }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new ApiError(400, 'Reply cursor is no longer available. Refresh the question.');
    const rows = await db.reply.findMany({
      where: { ...scope, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: REPLY_PAGE_LIMIT + 1,
      select: replySelection,
    });
    const replies = rows.slice(0, REPLY_PAGE_LIMIT);
    return NextResponse.json({ replies, nextCursor: rows.length > REPLY_PAGE_LIMIT ? replies.at(-1)!.id : null });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const body = await jsonBody(request);
    const user = await requireUser(request);
    const content = text(body.content, 'Reply', 2, 3000);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Question not found.');
    await consumeRateLimit('reply-user', user.id, 30, 3600);
    const reply = await getPrisma().$transaction(async (tx) => {
      await assertTransactionRole(tx, user, ['POSTER', 'HELPER', 'ADMIN']);
      const post = await tx.post.findFirst({ where: { id, collegeId: user.collegeId, author: { collegeId: user.collegeId } }, select: { id: true } });
      if (!post) throw new ApiError(404, 'Question not found.');
      return tx.reply.create({
        data: { content, postId: post.id, collegeId: user.collegeId, authorId: user.id },
        select: { id: true, content: true, createdAt: true, author: { select: publicAuthor } },
      });
    });
    return NextResponse.json({ reply }, { status: 201 });
  });
}
