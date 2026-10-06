import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { isHostedPilotReady, SetupNotice } from "@/components/service-gate";

// Read the launch switch per request, not once during a static build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Join your college community", robots: { index: false, follow: true } };

export default function JoinPage() {
  return <><SiteHeader /><main id="main-content" className="auth-shell wrap"><div className="auth-intro"><p className="eyebrow">Your college. A little more connected.</p><h1>New chapter.<br /><span className="highlight-word">Same team.</span></h1><p>From your first “where’s that classroom?” to your first placement interview. Find students and seniors who know the place.</p><ul className="auth-points"><li><span>✳</span> A board for your college, not the whole internet</li><li><span>✳</span> Real questions. Useful conversations.</li><li><span>✳</span> Your email stays off the public board</li></ul></div>{isHostedPilotReady() ? <AuthForm mode="join" /> : <SetupNotice />}</main><SiteFooter /></>;
}
