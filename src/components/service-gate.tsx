import Link from "next/link";
import { registrationAvailable } from "@/lib/deployment";

// Server-only readiness checks; never render signup on a hosted preview merely
// because a few credentials exist. An operator must explicitly open onboarding.
export const isHostedPilotReady = registrationAvailable;

export function SetupNotice() {
  return <section className="auth-card" aria-labelledby="setup-title"><p className="eyebrow">A small start, done properly</p><h2 id="setup-title">The campus pilot is getting ready.</h2><p>You can explore Bachaoo now. College signup will open after the production database, email verification and support process are ready. We’re not collecting registrations in the meantime.</p><p>Thanks for being early. Come back when your college pilot opens.</p><Link href="/" className="button button-outline">Explore Bachaoo ↗</Link></section>;
}
