import { NextResponse } from 'next/server';
import { assertTransactionRole, requireUserRole } from '@/lib/auth';
import { api, jsonBody, text } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { helpReplySelection, helpScope } from '@/lib/help';
import { ApiError } from '@/lib/errors';
import { consumeRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUserRole(['POSTER', 'HELPER'], request);
    const { id } = await context.params;
    const db = getPrisma();
    if (!/^[0-9a-f-]{36}$/i.test(id) || !await db.helpRequest.findFirst({ where: { ...helpScope(user), id }, select: { id: true } })) throw new ApiError(404, 'Help request not found.');
    const scope = { requestId: id, collegeId: user.collegeId, author: { collegeId: user.collegeId } };
    const before = new URL(request.url).searchParams.get('before');
    if (before !== null && !/^[0-9a-f-]{36}$/i.test(before)) throw new ApiError(400, 'Invalid reply cursor.');
    const cursor = before ? await db.helpReply.findFirst({ where: { ...scope, id: before }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new ApiError(400, 'Reply cursor is unavailable. Refresh the conversation.');
    const rows = await db.helpReply.findMany({
      where: { ...scope, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21, select: helpReplySelection,
    });
    const replies = rows.slice(0, 20);
    return NextResponse.json({ replies, nextCursor: rows.length > 20 ? replies.at(-1)!.id : null });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const body = await jsonBody(request);
    const user = await requireUserRole('HELPER', request);
    const content = text(body.content, 'Helper reply', 2, 3000);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Help request not found.');
    await consumeRateLimit('reply-user', user.id, 30, 3600);
    const reply = await getPrisma().$transaction(async tx => {
      await assertTransactionRole(tx, user, ['HELPER']);
      if (!await tx.helpRequest.findFirst({ where: { ...helpScope(user), id }, select: { id: true } })) throw new ApiError(404, 'Help request not found.');
      return tx.helpReply.create({ data: { content, requestId: id, collegeId: user.collegeId, authorId: user.id }, select: helpReplySelection });
    });
    return NextResponse.json({ reply }, { status: 201 });
  });
}
