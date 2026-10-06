import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { AdminSetup } from "@/components/admin-setup";

export const metadata: Metadata = { title: "Admin activation", robots: { index: false, follow: false } };
export default function AdminSetupPage() {
  return <><SiteHeader /><main id="main-content" className="auth-shell wrap"><div className="auth-intro"><p className="eyebrow">Operator invitation</p><h1>A stronger community starts with good Helpers.</h1><p>Activate the account invited by the Bachaoo operator. Admin access cannot be selected during public signup.</p></div><AdminSetup /></main><SiteFooter /></>;
}
