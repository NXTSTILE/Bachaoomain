import type { Prisma } from '../generated/prisma/client';
import { publicAuthor, type Member } from './auth';
import { ApiError } from './errors';

export function helpScope(user: Member): Prisma.HelpRequestWhereInput {
  if (user.role !== 'POSTER' && user.role !== 'HELPER') throw new ApiError(403, 'Private help is available to Posters and appointed Helpers.');
  return { collegeId: user.collegeId, author: { collegeId: user.collegeId }, ...(user.role === 'POSTER' ? { authorId: user.id } : {}) };
}

export const helpReplySelection = { id: true, content: true, createdAt: true, author: { select: publicAuthor } } as const;

export function helpSelection(collegeId: string) {
  const scope = { collegeId, author: { collegeId } };
  return { id: true, title: true, content: true, category: true, createdAt: true,
    author: { select: publicAuthor },
    _count: { select: { replies: { where: scope } } },
    replies: { where: scope, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: 10, select: helpReplySelection },
  } satisfies Prisma.HelpRequestSelect;
}
