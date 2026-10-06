import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireUserRole } from '@/lib/auth';
import { api } from '@/lib/http';
import { postSelection } from '@/lib/posts';
import { helpScope, helpSelection } from '@/lib/help';
import { memberQuotas } from '@/lib/quotas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return api(async () => {
    const user = await requireUserRole(['POSTER', 'HELPER'], request);
    const db = getPrisma();
    const scope = helpScope(user);
    const replyScope = { collegeId: user.collegeId, author: { collegeId: user.collegeId } };
    const ownNotices = { collegeId: user.collegeId, authorId: user.id, author: { collegeId: user.collegeId } };
    const [quotas, noticesPosted, notices, helpTotal, unansweredHelp, answeredByYou, helpRequests, helpedRequests] = await Promise.all([
      memberQuotas(user),
      db.post.count({ where: ownNotices }),
      db.post.findMany({ where: ownNotices, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: postSelection(user.collegeId) }),
      db.helpRequest.count({ where: scope }),
      db.helpRequest.count({ where: { ...scope, replies: { none: replyScope } } }),
      db.helpRequest.count({ where: { ...scope, replies: { some: { ...replyScope, authorId: user.id } } } }),
      db.helpRequest.findMany({ where: { ...scope, ...(user.role === 'HELPER' ? { replies: { none: replyScope } } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: helpSelection(user.collegeId) }),
      user.role === 'HELPER' ? db.helpRequest.findMany({ where: { ...scope, replies: { some: { ...replyScope, authorId: user.id } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: helpSelection(user.collegeId) }) : Promise.resolve([]),
    ]);
    return NextResponse.json({ user, role: user.role, quotas, stats: { noticesPosted, helpTotal, unansweredHelp, answeredByYou }, notices, helpRequests, helpedRequests });
  });
}
