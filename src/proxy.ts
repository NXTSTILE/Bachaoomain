import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';

// This is an optimistic UX gate, never the authorization boundary for API data.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  try {
    const session = token ? await verifySessionToken(token) : null;
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
    // Fresh page/API database checks decide roles, so stale cookies cannot
    // cause redirect loops after an Admin appoints or revokes a Helper.
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/campus/:path*', '/poster/:path*', '/helper/:path*', '/superadmin/:path*'],
};
