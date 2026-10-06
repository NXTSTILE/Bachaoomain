import bcrypt from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';
import { effectiveRole, sessionResponse, validMembership } from '@/lib/auth';
import { loginEmail, isRole } from '@/lib/colleges';
import { api, jsonBody } from '@/lib/http';
import { passwordInput } from '@/lib/password-validation';
import { ApiError } from '@/lib/errors';
import { consumeRateLimit, requestIdentity } from '@/lib/rate-limit';

export const runtime = 'nodejs';
// A valid cost-12 dummy hash keeps missing-account checks comparable to real checks.
const DUMMY_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody(request);
    const email = loginEmail(body.email);
    const password = passwordInput(body.password);
    // Shared campus NATs need a wider budget; each account still gets ten tries.
    await consumeRateLimit('login-ip', requestIdentity(request), 600, 900);
    await consumeRateLimit('login-email', email, 10, 900);
    const user = await getPrisma().user.findUnique({ where: { email } });
    const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !matches || !validMembership(user) || !isRole(user.role)) throw new ApiError(401, 'Invalid email or password.');
    return sessionResponse({ id: user.id, role: effectiveRole(user) });
  });
}
