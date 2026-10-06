import 'dotenv/config';
import { deploymentChecks } from '../src/lib/deployment';

// Validate the hosted production configuration without printing secrets,
// connecting to a database, sending mail, or applying migrations.
const checks = deploymentChecks({ ...process.env, NODE_ENV: 'production', VERCEL: '1' });
for (const [name, ready] of Object.entries(checks)) console.info(`${ready ? 'PASS' : 'MISSING'} ${name}`);
if (Object.values(checks).some(ready => !ready)) {
  console.error('Public onboarding is not ready. See README.md; a closed preview can still be deployed.');
  process.exitCode = 1;
} else {
  console.info('Configuration checks passed. Still verify remote migrations, real email delivery, and the operator support process before opening registration.');
}
