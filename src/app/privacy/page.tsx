import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { supportEmail } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Privacy notice", description: "What Bachaoo collects, what your college community can see, and how we use your information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  const contact = supportEmail();
  return <><SiteHeader /><main id="main-content" className="content-page wrap">
    <p className="eyebrow">The important stuff, in plain English</p><h1>Your college email isn’t a public profile.</h1>
    <p>Bachaoo is an early-stage college notice-board and private-help community.</p>
    <h2>What we collect</h2>
    <p>We store your verified email, display name, hashed password, college identifier, self-declared study year and current role. We also store notices, private help requests, replies, timestamps, daily publication allowances, temporary verification/invitation digests, abuse-prevention counters, Helper appointments and role-change audit records. Admin accounts may be created through operator-issued email invitations.</p>
    <h2>Who can see your content</h2>
    <p>Signed-in members of your college can see your notices and their replies, with your name, role and study year. Private help requests and Helper responses are visible only to their requester and appointed Helpers in that college. Other Posters cannot access your private requests. The Admin management page grants no separate private-help access. Neither conversation exposes your email or password.</p>
    <p>Private help is access-controlled, not end-to-end encrypted. Authorized service operators and infrastructure providers may process stored content to operate the service and handle support/removal requests. Don’t post phone numbers, student IDs, passwords or other sensitive details.</p>
    <h2>Why we use it</h2>
    <p>We verify mailboxes, keep you signed in, select your college, enforce private-help permissions, deliver verification/invitation emails and limit abuse. Admins can look up verified members by registered email to appoint/revoke Helpers. An appointment is permission to help, not proof of identity or expertise.</p>
    <h2>Cookies and service providers</h2>
    <p>An essential HTTP-only session cookie keeps you signed in for up to seven days. Signing out removes it from your browser. The app does not add advertising cookies or third-party marketing trackers. Hosting, database and transactional-email providers process information needed to operate the service. The deployment uses Vercel, Brevo and Turso/libSQL. Providers may retain operational logs under their own policies.</p>
    <p>Unsent notice, help and reply drafts are kept in this browser tab’s session storage, scoped to your account, so a refresh does not lose your writing. Drafts are removed when you save them or log out; closing the tab normally clears them. They are not sent to the server until you submit. Avoid leaving drafts on a shared device.</p>
    <h2>Retention and account controls</h2>
    <p>Verification codes expire after ten minutes and are invalidated when used. Admin invitations expire after 24 hours and are consumed once. Account details, conversations, daily allowances and role audits remain stored until handled by an operator. Self-service account deletion and data export are not available in this early release.</p>
    {contact ? <p>For an account-data copy, removal request or account-access problem, email <a href={`mailto:${contact}`}>{contact}</a> from your registered address. The operator will verify ownership before handling your request. Never send your password, invitation link or verification code.</p> : <p>Registrations remain closed until a monitored privacy/support contact and an operator process for these requests are established.</p>}
    <h2>No sale of your information</h2><p>The current application has no advertising, data-sale or marketing-list integration. This notice should be reviewed whenever the product or its providers change.</p>
  </main><SiteFooter /></>;
}
