import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { api } from '@/lib/http';
import { memberQuotas } from '@/lib/quotas';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  return api(async () => NextResponse.json({ quotas: await memberQuotas(await requireUser(request)) }));
}
