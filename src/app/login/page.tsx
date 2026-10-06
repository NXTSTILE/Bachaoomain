import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/service-gate";
import { loginAvailable, supportEmail } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };

export default function LoginPage() {
  return <><SiteHeader /><main id="main-content" className="auth-shell wrap"><div className="auth-intro"><p className="eyebrow">Pick up where you left off</p><h1>Hey, you.<br /><span className="highlight-word">Welcome back.</span></h1><p>A question to ask? A little wisdom to share? Your college community is one login away.</p></div>{loginAvailable() ? <AuthForm mode="login" supportContact={supportEmail()} /> : <SetupNotice />}</main><SiteFooter /></>;
}
