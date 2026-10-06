import type { Prisma } from '../generated/prisma/client';
import { publicAuthor } from './auth';

export const REPLY_PREVIEW_LIMIT = 10;
export const REPLY_PAGE_LIMIT = 20;
export const replySelection = { id: true, content: true, createdAt: true, author: { select: publicAuthor } } as const;

export function postSelection(collegeId: string) {
  return {
    id: true,
    title: true,
    content: true,
    category: true,
    createdAt: true,
    author: { select: publicAuthor },
    _count: { select: { replies: { where: { collegeId, author: { collegeId } } } } },
    replies: {
      where: { collegeId, author: { collegeId } },
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: REPLY_PREVIEW_LIMIT,
      select: replySelection,
    },
  } satisfies Prisma.PostSelect;
}
