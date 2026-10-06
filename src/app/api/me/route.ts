import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { api } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return api(async () => NextResponse.json({ user: await requireUser(request) }));
}
