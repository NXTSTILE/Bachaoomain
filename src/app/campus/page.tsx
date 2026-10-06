import type { Metadata } from "next";
import { CampusBoard } from "@/components/campus-board";
import { pageMember } from "@/lib/page-auth";

export const metadata: Metadata = { title: "College notice board", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CampusPage() {
  return <CampusBoard user={await pageMember()} />;
}
