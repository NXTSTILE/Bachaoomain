import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Bachaoo home">
      <span className="brand-mark" aria-hidden="true">b<span>!</span></span>
      <span>bachaoo<span className="brand-dot">.</span></span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header wrap">
      <Brand />
      <nav aria-label="Main navigation" className="header-nav">
        <Link href="/#how-it-works" className="desktop-link">How it works</Link>
        <Link href="/login" className="button button-outline button-small">Log in</Link>
        <Link href="/join" className="button button-dark button-small">Sign up <span aria-hidden="true">↗</span></Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer wrap">
      <div><Brand /><p>Less figuring it out alone. More figuring it out together.</p></div>
      <nav aria-label="Footer navigation">
        <Link href="/community">Community & safety</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/join">Join your college ↗</Link>
      </nav>
      <p className="footer-note">Built for students. Not affiliated with any university.</p>
    </footer>
  );
}
