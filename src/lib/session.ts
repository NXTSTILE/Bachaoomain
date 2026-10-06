import { SignJWT, jwtVerify } from 'jose';
import { isRole, type Role } from './colleges';
import { unavailable } from './errors';

export const SESSION_COOKIE = 'auth-token';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = 'bachaoo';
const AUDIENCE = 'bachaoo-campus';
export type Session = { id: string; role: Role };

export function signingKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) throw unavailable('Authentication');
  return new TextEncoder().encode(secret);
}

export async function issueSessionToken(session: Session): Promise<string> {
  if (!session.id || !isRole(session.role)) throw unavailable('Authentication');
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(session.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(signingKey());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  const key = signingKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
      typ: 'JWT', requiredClaims: ['sub', 'iat', 'exp', 'role'],
      maxTokenAge: `${SESSION_SECONDS}s`,
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 100 || !isRole(payload.role) || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  };
}
