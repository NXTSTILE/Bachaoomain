import type { Metadata } from "next";
import { RoleDashboard } from "@/components/role-dashboard";
import { pageMember } from "@/lib/page-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Helper dashboard", robots: { index: false, follow: false } };

export default async function HelperPage() {
  return <RoleDashboard role="HELPER" initialUser={await pageMember(['HELPER'])} />;
}
