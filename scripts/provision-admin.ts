import { config } from 'dotenv';
import { inviteAdmin } from '../src/lib/admin-invite';
import { getPrisma } from '../src/lib/prisma';
import { loginEmail } from '../src/lib/colleges';
import { provisionVerifiedAdmin } from '../src/lib/admin';

config({ override: true, quiet: true });
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to deliberately provision the named Admin.');
  const email = loginEmail(process.argv.find(value => value.includes('@')));
  const collegeId = 'centurion';
  const db = getPrisma();
  try {
    const account = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (account) {
      const changed = await provisionVerifiedAdmin(email, collegeId);
      console.info(changed ? 'Verified member promoted to Admin; their password was preserved.' : 'Admin account already provisioned.');
    } else {
      await inviteAdmin(email, collegeId, process.env.NEXT_PUBLIC_SITE_URL || '');
      console.info('Admin activation invitation submitted to the email provider. No invitation token or password was printed.');
    }
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Admin provisioning stopped. Check the named account, database, site origin and email service. No secrets were printed.'); process.exitCode = 1; });
