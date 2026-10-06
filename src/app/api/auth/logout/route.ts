import { NextResponse } from 'next/server';
import { api, sameOrigin } from '@/lib/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const response = NextResponse.json({ message: 'Signed out.' });
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  });
}
