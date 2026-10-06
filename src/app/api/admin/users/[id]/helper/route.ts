import { NextResponse } from 'next/server';
import { requireUserRole } from '@/lib/auth';
import { appointHelper } from '@/lib/admin';
import { api, jsonBody } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { consumeRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const body = await jsonBody(request);
    const admin = await requireUserRole('ADMIN', request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'Member not found.');
    if (typeof body.enabled !== 'boolean' || (body.expectedRole !== undefined && body.expectedRole !== 'POSTER' && body.expectedRole !== 'HELPER')) throw new ApiError(400, 'Specify a valid Helper appointment.');
    await consumeRateLimit('admin-role-user', admin.id, 60, 3600);
    return NextResponse.json(await appointHelper(admin, id, body.enabled, body.expectedRole as string | undefined));
  });
}
