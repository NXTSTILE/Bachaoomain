import type { Prisma } from '../generated/prisma/client';
import { getPrisma } from './prisma';
import { ApiError } from './errors';
import type { Member } from './auth';

export type FormKind = 'NOTICE_BOARD' | 'HELP_REQUEST';
const IST_OFFSET = 330 * 60 * 1000;

export function publishingDay(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET);
  const day = shifted.toISOString().slice(0, 10);
  const resetAt = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - IST_OFFSET);
  return { day, resetAt };
}

export async function reserveDailyQuota(tx: Prisma.TransactionClient, member: Member, kind: FormKind, now = new Date()) {
  const { day, resetAt } = publishingDay(now);
  const rows = await tx.$queryRaw<{ userId: string }[]>`
    INSERT INTO "DailyQuota" ("userId", "collegeId", "kind", "day")
    VALUES (${member.id}, ${member.collegeId}, ${kind}, ${day})
    ON CONFLICT ("userId", "collegeId", "kind", "day") DO NOTHING RETURNING "userId"
  `;
  if (!rows.length) throw new ApiError(429,
    kind === 'NOTICE_BOARD' ? 'You have already posted a notice today. Your notice quota resets at midnight IST.' : 'You have already submitted a help request today. Your help quota resets at midnight IST.',
    Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)));
}

export async function memberQuotas(member: Member, now = new Date()) {
  const { day, resetAt } = publishingDay(now);
  const used = await getPrisma().dailyQuota.findMany({ where: { userId: member.id, collegeId: member.collegeId, day }, select: { kind: true } });
  return { day, timezone: 'Asia/Kolkata', resetAt: resetAt.toISOString(),
    notice: { remaining: member.role === 'POSTER' && !used.some(row => row.kind === 'NOTICE_BOARD') ? 1 : 0 },
    help: { remaining: member.role === 'POSTER' && !used.some(row => row.kind === 'HELP_REQUEST') ? 1 : 0 },
  };
}
