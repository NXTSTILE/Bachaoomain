"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="empty-page"><span className="empty-symbol" aria-hidden="true">!</span><h1>A small detour.</h1><p>Something didn’t load. Your saved questions aren’t stored in this screen, so you can safely try again.</p><div className="inline-actions"><button className="button button-dark" onClick={reset}>Try again</button><Link href="/" className="button button-outline">Back home</Link></div></main>;
}
