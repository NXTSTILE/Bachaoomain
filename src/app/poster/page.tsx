import type { Metadata } from "next";
import { RoleDashboard } from "@/components/role-dashboard";
import { pageMember } from "@/lib/page-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Poster dashboard", robots: { index: false, follow: false } };

export default async function PosterPage() {
  return <RoleDashboard role="POSTER" initialUser={await pageMember(['POSTER'])} />;
}
