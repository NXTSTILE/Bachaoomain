import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { siteDescription, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Bachaoo — Your college. Your seniors. Your people.",
  alternates: { canonical: "/" },
};

const topics = [
  { icon: "↗", title: "Placements, minus the panic", text: "Resumes, interview prep and the things a job description won’t tell you.", tag: "Career unlocked", color: "lilac" },
  { icon: "✳", title: "That one impossible subject", text: "Ask how to approach a tricky topic. Learn the method, not just the answer.", tag: "Academic backup", color: "peach" },
  { icon: "⌘", title: "Build something with someone", text: "Get a second opinion on your project, tech stack or hackathon idea.", tag: "Ideas → action", color: "mint" },
  { icon: "♡", title: "Campus comes with questions", text: "Clubs, first-week nerves and finding your place. Someone’s been there.", tag: "You belong here", color: "yellow" },
];

const faqs = [
  ["Who is Bachaoo for?", "Students who need a little direction and seniors who want to pass it on. Our first college community is Centurion University. More colleges aren’t open yet."],
  ["How do you join your college?", "Verify your supported college email with a one-time code. You join as a Poster with two separate forms: a college notice and a private help request, each with one submission per day, resetting at midnight IST."],
  ["Who can become a Helper?", "An Admin appoints verified college members as Helpers. You cannot select that role at signup. Study year is self-declared; an appointment is permission to help, not a university endorsement or a checked qualification."],
  ["Who can see what I post?", "Notices and their replies are visible to signed-in members of your college. Private help is visible only to its requester and appointed college Helpers. Your email address stays off both conversations."],
  ["Can I join from another college?", "Not yet. We’re starting with Centurion student addresses on centurionuniv.edu.in and cutm.ac.in. We’ll only open another college when its email domains are supported."],
];

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bachaoo",
    url: siteUrl,
    description: siteDescription,
    inLanguage: "en",
  };

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> The campus connection you were missing</p>
            <h1 id="hero-title">College is a lot.<br />Don’t <span className="highlight-word">solo it.</span></h1>
            <p className="hero-description">Share a notice with your college, or ask appointed Helpers for private support. Two ways to connect with people who know the place.</p>
            <div className="hero-actions">
              <Link href="/join" className="button button-dark">Sign up <span aria-hidden="true">↗</span></Link>
              <a href="#how-it-works" className="button button-outline">Wait, how does it work?</a>
            </div>
            <p className="hero-footnote"><span aria-hidden="true">✦</span> Starting at Centurion University · College-email access</p>
          </div>

          <div className="hero-board" aria-label="Example of a student question and a senior reply">
            <div className="board-top"><span className="tiny-brand">b!</span><span>your campus, in your corner</span><span aria-hidden="true">↗</span></div>
            <div className="example-label">A little preview · illustrative conversation</div>
            <div className="question-preview">
              <div className="person-row"><span className="avatar avatar-peach" aria-hidden="true">J</span><div><strong>A first-year student</strong><span>Figuring things out</span></div><span className="pill">Campus life</span></div>
              <p className="preview-question">Is it too early to join a hackathon if I’m still learning to code?</p>
              <span className="preview-detail">Asking for me. Not a friend. 🫠</span>
            </div>
            <div className="reply-preview">
              <div className="person-row"><span className="avatar avatar-purple" aria-hidden="true">S</span><div><strong>A senior who gets it</strong><span>Been there, built that</span></div><span aria-hidden="true">✳</span></div>
              <p>Not at all! Start with a small idea and a team you can learn with. My first project barely worked. I still learned a ton.</p>
            </div>
            <div className="board-bottom"><span>No question too basic.</span><span className="handwritten">you’ve got people ↗</span></div>
            <span className="floating-sticker" aria-hidden="true">less stress.<br />more seniors.</span>
          </div>
        </section>

        <div className="topic-strip" aria-label="Things you can ask about"><div className="wrap"><span>Real people.</span><span>Same college.</span><span>A little less chaos.</span><span aria-hidden="true">✳</span></div></div>

        <section className="section wrap" id="explore" aria-labelledby="topics-title">
          <div className="section-heading"><div><p className="eyebrow">Big questions. Small questions. All welcome.</p><h2 id="topics-title">There’s a senior<br />for that.</h2></div><p>Skip the awkward “hey, sorry to bother you.”<br />This is exactly what the board is for.</p></div>
          <div className="topic-grid">{topics.map(topic => (
            <Link href="/join" key={topic.title} className={`topic-card ${topic.color}`}>
              <div className="topic-icon" aria-hidden="true">{topic.icon}</div><span className="topic-tag">{topic.tag}</span>
              <h3>{topic.title}</h3><p>{topic.text}</p><span className="card-arrow" aria-label="Join to ask">↗</span>
            </Link>
          ))}</div>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title"><div className="section wrap">
          <div className="section-heading"><div><p className="eyebrow">No networking personality required</p><h2 id="how-title">From “help?” to<br />“okay, I’ve got this.”</h2></div><Link href="/join" className="button button-lime">Let’s do this <span aria-hidden="true">↗</span></Link></div>
          <ol className="steps">
            <li><span className="step-number">01</span><h3>Your email is your way in.</h3><p>Verify your supported college email. We’ll put you in the right college community.</p></li>
            <li><span className="step-number">02</span><h3>Choose the right conversation.</h3><p>Publish a college notice or send a private help request. Each form has its own daily allowance.</p></li>
            <li><span className="step-number">03</span><h3>Keep the knowledge moving.</h3><p>Every member can reply to notices. Appointed Helpers respond to private requests on their Helper dashboard.</p></li>
          </ol>
        </div></section>

        <section className="section wrap senior-section" aria-labelledby="senior-title"><div className="senior-art" aria-hidden="true"><span>been there.</span><span>helped that.</span><span className="senior-star">✳</span></div><div><p className="eyebrow">Hey, seniors. This bit’s for you.</p><h2 id="senior-title">Be the person you<br />needed in first year.</h2><p>You don’t need all the answers. A useful reply, an honest experience, a nudge in the right direction — that counts.</p><Link href="/join" className="button button-dark">Join my college <span aria-hidden="true">↗</span></Link><p className="small-note">Everyone joins as a Poster. Your Admin can appoint you as a Helper.</p></div></section>

        <section className="section wrap faq-section" aria-labelledby="faq-title"><div><p className="eyebrow">Before you jump in</p><h2 id="faq-title">Fair questions.</h2><p>Community first.<br />No made-up promises.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

        <section className="final-cta wrap"><p className="eyebrow">Your next chapter has a group chat energy.</p><h2>Same campus.<br />Better company.</h2><Link href="/join" className="button button-dark">Find your people <span aria-hidden="true">↗</span></Link><p>Your college notice board. Your private help conversations.</p></section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
