import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Lost and found is not available", robots: { index: false, follow: false } };

export default function LostItemPage() {
  return <main id="main-content" className="empty-page"><span className="empty-symbol" aria-hidden="true">⌕</span><h1>Looking for something?</h1><p>You can publish a lost-item notice for your college using the Notice Board Form. Describe the item and where you last saw it. You can also contact your college’s official lost-and-found service.</p><Link href="/poster?section=notice" className="button button-dark">Open Notice Board Form ↗</Link><Link href="/campus" className="text-button">Browse college notices →</Link></main>;
}
