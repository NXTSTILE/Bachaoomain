import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { supportEmail } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Community & safety", description: "The Bachaoo community rules: be kind, share useful experience, protect personal information and learn together.", alternates: { canonical: "/community" } };

export default function CommunityPage() {
  const contact = supportEmail();
  return <><SiteHeader /><main id="main-content" className="content-page wrap">
    <p className="eyebrow">Good advice starts with a good community</p><h1>Be the person you’d want to ask.</h1>
    <p>Bachaoo connects students through a college notice board and private help requests. It works best when everyone makes it a little easier to ask for help.</p>
    <h2>Our house rules</h2><ul>
      <li><strong>Be kind, not gatekeep-y.</strong> No harassment, hate, bullying, impersonation or sharing someone else’s information.</li>
      <li><strong>Teach the approach.</strong> Help someone understand a concept. Don’t offer exam leaks, impersonation or academic cheating.</li>
      <li><strong>Keep it useful.</strong> Add context to requests. Be honest about your experience. No spam, scams or unsolicited promotions.</li>
      <li><strong>Protect your privacy.</strong> Don’t post phone numbers, addresses, passwords, student IDs or confidential documents.</li>
      <li><strong>No money requests.</strong> The platform is for peer guidance, not paid tasks or transactions.</li>
    </ul>
    <h2>Know who you’re talking to</h2>
    <p>Students verify a supported college email and join as Posters. Admins appoint verified members as Helpers; the Helper role cannot be selected at signup. Study year is self-declared. Appointment is permission to help, not proof of qualifications. Bachaoo does not guarantee answers or endorse advice and is not affiliated with Centurion University or any other college.</p>
    <h2>Two forms, two audiences</h2>
    <p>Notices and notice replies are visible to signed-in members of the same college. Private help requests and Helper responses are visible only to their requester and appointed Helpers in that college. Other Posters cannot read them, and the Admin management page grants no private-help access. Private help is not end-to-end encrypted.</p>
    <p>Posters may publish one notice and one help request independently per day. Both allowances reset at midnight IST. Any college member may reply to notices; only appointed Helpers may reply to private help.</p>
    <h2>If something doesn’t feel right</h2>
    <p>Don’t share more personal information or agree to meet someone you don’t trust. For urgent concerns, contact your college’s official student-support or security team; in an emergency, use your local emergency number. The pilot does not yet offer an in-app reporting or moderation queue.</p>
    {contact ? <p>Report harassment, spam or exposed personal information to <a href={`mailto:${contact}`}>{contact}</a>. Include the notice/request title, approximate time and a description of the issue, but no passwords or unnecessary personal details. Reports are reviewed by the pilot operator; this is not a 24-hour emergency service.</p> : <p>Registrations remain closed until a responsible operator and monitored reporting contact are in place.</p>}
    <h2>First college, small start</h2><p>The current allowlist supports Centurion University’s 12-digit student emails at <strong>centurionuniv.edu.in</strong> and <strong>cutm.ac.in</strong>. Communities for other colleges are not open yet.</p>
    <Link href="/" className="button button-outline">Back to Bachaoo ↗</Link>
  </main><SiteFooter /></>;
}
