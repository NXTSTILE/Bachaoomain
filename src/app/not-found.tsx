import Link from "next/link";

export default function NotFound() {
  return <main id="main-content" className="empty-page"><span className="empty-symbol" aria-hidden="true">404</span><h1>A little lost? Same.</h1><p>This page doesn’t exist. Let’s get you back to your people.</p><Link href="/" className="button button-dark">Take me home ↗</Link></main>;
}
