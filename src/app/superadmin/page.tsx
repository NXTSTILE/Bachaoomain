import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin-panel";
import { pageMember } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  return <AdminPanel user={await pageMember(['ADMIN'])} />;
}
