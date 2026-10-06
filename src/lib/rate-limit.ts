import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { getPrisma } from './prisma';
import { ApiError, unavailable } from './errors';
import { signingKey } from './session';

export function rateKey(scope: string, identity: string): string {
  return createHmac('sha256', signingKey()).update(`rate:${scope}:${identity}`).digest('hex');
}

export function requestIdentity(request: Request, env: Record<string, string | undefined> = process.env): string {
  // Vercel overwrites this header. No generic forwarding header is trustworthy
  // without a separately reviewed ingress that strips client-supplied values.
  if (env.VERCEL === '1') {
    const ip = request.headers.get('x-vercel-forwarded-for')?.trim();
    if (ip && isIP(ip)) return ip;
    throw unavailable('Request verification');
  }
  if (!env.VERCEL_ENV) {
    if (env.NODE_ENV !== 'production') return 'local';
    // Explicitly opt in for `next start --hostname 127.0.0.1` smoke tests only.
    // Never enable this on a public deployment: URL hosts do not prove peer IPs.
    const url = new URL(request.url);
    if (env.AUTH_LOCAL_TESTING === '1' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return 'local';
    }
  }
  // Unsupported production ingress must not silently pool every user as local.
  throw unavailable('Request verification');
}

export async function consumeRateLimit(scope: string, identity: string, limit: number, windowSeconds: number): Promise<void> {
  const key = rateKey(scope, identity);
  const now = BigInt(Date.now());
  const end = now + BigInt(windowSeconds * 1000);
  // One conditional SQLite UPSERT: concurrent serverless instances cannot overspend
  // a read-then-write counter. Expired windows reset in the same statement.
  const rows = await getPrisma().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${key}, 1, ${end})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${end} ELSE "RateLimit"."expiresAt" END
    WHERE "RateLimit"."expiresAt" <= ${now} OR "RateLimit"."count" < ${limit}
    RETURNING "count"
  `;
  if (!rows.length) {
    const bucket = await getPrisma().rateLimit.findUnique({ where: { key }, select: { expiresAt: true } });
    const remaining = Math.min(windowSeconds, Math.max(1, Math.ceil((Number(bucket?.expiresAt ?? end) - Date.now()) / 1000)));
    throw new ApiError(429, 'Too many attempts. Please wait before trying again.', remaining);
  }
}

export async function cleanExpiredAuthRecords(): Promise<void> {
  const db = getPrisma();
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: BigInt(Date.now() - 24 * 60 * 60 * 1000) } } });
  await db.otp.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
