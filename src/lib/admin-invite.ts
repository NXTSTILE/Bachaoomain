import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getPrisma } from './prisma';
import { COLLEGES, loginEmail } from './colleges';
import { ApiError } from './errors';
import { sendAdminInvitation } from './email';

export function invitationDigest(token: string) { return createHash('sha256').update(token).digest('hex'); }

// Called only by the private operator CLI, never by a public signup endpoint.
export async function inviteAdmin(value: string, collegeId: string, origin: string) {
  const email = loginEmail(value);
  if (!COLLEGES.some(college => college.id === collegeId)) throw new ApiError(400, 'Choose a supported college.');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new ApiError(400, 'Configure the final HTTPS site origin.');
  const db = getPrisma();
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new ApiError(409, 'This email already has an account. Provision its role through the verified-member operator workflow.');
  const token = randomBytes(32).toString('hex');
  const id = randomUUID();
  const data = { id, collegeId, digest: invitationDigest(token), delivered: false, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), createdAt: new Date() };
  await db.adminInvite.upsert({ where: { email }, create: { ...data, email }, update: data });
  try {
    // A fragment is not transmitted in HTTP URLs, access logs or referrer headers.
    await sendAdminInvitation(email, `${url.origin}/admin/setup#invite=${token}`);
    await db.adminInvite.updateMany({ where: { id }, data: { delivered: true } });
  } catch (error) { await db.adminInvite.deleteMany({ where: { id } }); throw error; }
}
