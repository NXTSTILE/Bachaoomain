"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { POST_CATEGORIES } from "@/lib/colleges";
import { ClientApiError, ConversationFeed, MemberHeader, MemberIntro, dateLabel, displayError, requestJson, type MemberProfile, type Quotas } from "./member-ui";
import { useSessionDraft } from "./session-draft";

type Dashboard = { user: MemberProfile; role: string; quotas: Quotas; stats: { noticesPosted: number; helpTotal: number; unansweredHelp: number; answeredByYou: number } };
type Draft = { title: string; content: string; category: string };
const emptyNotice: Draft = { title: "", content: "", category: "Campus life" };
const emptyHelp: Draft = { title: "", content: "", category: "Academics" };
function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Draft;
  return typeof draft.title === "string" && draft.title.length <= 160 && typeof draft.content === "string" && draft.content.length <= 5000 && POST_CATEGORIES.some(category => category === draft.category);
}

function PosterForm({ kind, draft, onDraft, ready, quotas, onSaved }: { kind: "notice" | "help"; draft: Draft; onDraft: (draft: Draft) => void; ready: boolean; quotas?: Quotas; onSaved: () => Promise<void> }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [savedDay, setSavedDay] = useState("");
  const busy = useRef(false);
  const remaining = quotas?.[kind].remaining;
  const exhausted = remaining === 0 || Boolean(savedDay && savedDay === quotas?.day);
  const hasDraft = Boolean(draft.title || draft.content);
  const label = kind === "notice" ? "Notice Board Form" : "Help Form";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || !ready || !quotas || exhausted) return;
    busy.current = true; setPending(true); setError(""); setNotice("");
    try {
      if (draft.title.trim().length < 5) throw new Error("Write a title with at least 5 characters.");
      if (draft.content.trim().length < 10) throw new Error("Add at least 10 characters of details so people can understand your message.");
      await requestJson(kind === "notice" ? "/api/notice-board" : "/api/help-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      setSavedDay(quotas.day); onDraft(kind === "notice" ? emptyNotice : emptyHelp);
      setNotice(kind === "notice" ? "Notice saved to your college board. Find it in Your notices below." : "Help request saved privately for appointed Helpers. Check Your private help requests below for responses.");
      await onSaved();
    } catch (err) {
      setError(displayError(err));
      if (err instanceof ClientApiError && err.status === 429) { setSavedDay(quotas.day); await onSaved(); }
      if (err instanceof ClientApiError && [401, 403].includes(err.status)) router.refresh();
    } finally { busy.current = false; setPending(false); }
  }
  return <section className={`publish-panel ${kind === "help" ? "private-panel" : ""}`} aria-labelledby={`form-${kind}-heading`}>
    <div className="publish-heading"><div><p className="eyebrow">{kind === "notice" ? "Visible to your college" : "Only you and appointed Helpers"}</p><h2 id={`form-${kind}-heading`}>{label}</h2></div><span className="quota-badge">{remaining === undefined ? "Checking quota…" : `${exhausted ? 0 : remaining} left today`}</span></div>
    <p className="field-hint">{kind === "notice" ? "Share a notice with your college. Any member can read it and reply." : "Ask for help privately. This request will never appear on the notice board."} One submission per day for this form.</p>
    {quotas && <p className="quota-reset">Next allowance: <time dateTime={quotas.resetAt}>{dateLabel(quotas.resetAt)} at 12:00 midnight IST</time>. Notice and help allowances are separate.</p>}
    {exhausted && <p className="quota-notice" role="status">You’ve used today’s {kind === "notice" ? "notice" : "help"} allowance. This form unlocks at midnight IST. You can still read your conversations{kind === "notice" ? " and reply to notices" : ""}.</p>}
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      {error && <p className="form-notice" role="alert">{error}</p>}{notice && <p className="form-notice success-notice" role="status">{notice}</p>}
      <div className="field"><label htmlFor={`${kind}-title`}>{kind === "notice" ? "Notice title" : "Help request title"}</label><input id={`${kind}-title`} name="title" required minLength={5} maxLength={160} disabled={pending || !ready} value={draft.title} onChange={event => onDraft({ ...draft, title: event.target.value })} placeholder={kind === "notice" ? "A club meet, a campus update, something useful…" : "What do you need a hand with?"} aria-describedby={`${kind}-title-hint`} /><small id={`${kind}-title-hint`}>{draft.title.length}/160 characters · at least 5</small></div>
      <div className="field"><label htmlFor={`${kind}-category`}>{kind === "notice" ? "Notice topic" : "Help topic"}</label><select id={`${kind}-category`} disabled={pending || !ready} value={draft.category} onChange={event => onDraft({ ...draft, category: event.target.value })}>{POST_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></div>
      <div className="field"><label htmlFor={`${kind}-content`}>{kind === "notice" ? "Notice message" : "Help details"}</label><textarea id={`${kind}-content`} required minLength={10} maxLength={5000} rows={5} disabled={pending || !ready} value={draft.content} onChange={event => onDraft({ ...draft, content: event.target.value })} placeholder={kind === "notice" ? "Include the details your college should know." : "Explain what you’ve tried and what kind of guidance would help."} aria-describedby={`${kind}-content-hint`} /><small id={`${kind}-content-hint`}>{draft.content.length.toLocaleString("en-IN")}/5,000 characters · at least 10</small></div>
      <div className="draft-status"><small>{hasDraft ? "Draft kept in this browser tab until you save, clear it or log out." : "Your unsent draft will be kept in this browser tab."}</small>{hasDraft && <button type="button" className="text-button" disabled={pending} onClick={() => { onDraft(kind === "notice" ? emptyNotice : emptyHelp); setError(""); }}>Clear draft</button>}</div>
      <button type="submit" className="button button-dark" disabled={pending || !ready || remaining === undefined || exhausted}>{pending ? "Saving…" : kind === "notice" ? "Publish notice ↗" : "Send private help request ↗"}</button>
    </form>
  </section>;
}

export function RoleDashboard({ role, initialUser }: { role: "POSTER" | "HELPER"; initialUser: MemberProfile }) {
  const router = useRouter();
  const search = useSearchParams();
  const tab = search.get("section") === "help" ? "help" : "notice";
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("unanswered");
  const [noticeDraft, setNoticeDraft, noticeReady] = useSessionDraft(`${initialUser.id}:notice:publish`, emptyNotice, validDraft);
  const [helpDraft, setHelpDraft, helpReady] = useSessionDraft(`${initialUser.id}:help:publish`, emptyHelp, validDraft);
  const [generation, setGeneration] = useState(0);
  const apply = useCallback((data: Dashboard) => {
    if (data.role !== role) { setDashboard(null); router.replace(data.role === "HELPER" ? "/helper" : data.role === "ADMIN" ? "/superadmin" : "/poster"); router.refresh(); return; }
    setDashboard(data); setError("");
  }, [role, router]);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<Dashboard>("/api/dashboard", { signal: controller.signal }).then(data => { if (!controller.signal.aborted) apply(data); }).catch(err => { if (!controller.signal.aborted) { setError(displayError(err)); if (err instanceof ClientApiError && [401, 403].includes(err.status)) router.refresh(); } });
    return () => controller.abort();
  }, [apply, router]);
  useEffect(() => {
    const resetAt = dashboard?.quotas.resetAt;
    if (!resetAt) return;
    const controller = new AbortController();
    function update() {
      if (document.visibilityState !== "visible") return;
      requestJson<Dashboard>("/api/dashboard", { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) apply(data); })
        .catch(err => { if (!controller.signal.aborted) { setError(displayError(err)); if (err instanceof ClientApiError && [401, 403].includes(err.status)) router.refresh(); } });
    }
    const deadline = window.setTimeout(update, Math.max(1000, Date.parse(resetAt) - Date.now() + 100));
    const retry = window.setInterval(() => { if (Date.parse(resetAt) <= Date.now()) update(); }, 60000);
    document.addEventListener("visibilitychange", update);
    return () => { controller.abort(); window.clearTimeout(deadline); window.clearInterval(retry); document.removeEventListener("visibilitychange", update); };
  }, [dashboard?.quotas.resetAt, apply, router]);
  async function refresh() {
    // Refresh activity even when the stats endpoint is temporarily unavailable.
    setGeneration(value => value + 1);
    try { apply(await requestJson<Dashboard>("/api/dashboard")); }
    catch (err) { setError(displayError(err)); if (err instanceof ClientApiError && [401, 403].includes(err.status)) { setDashboard(null); router.refresh(); } }
  }
  const user = dashboard?.user || initialUser;
  return <>
    <MemberHeader user={user} active="dashboard" />
    <main id="main-content" className="member-layout wrap">
      <MemberIntro user={user} label={role === "POSTER" ? "Poster dashboard" : "Helper dashboard"} title={role === "POSTER" ? "Your campus. Two ways to connect." : "A little help goes a long way."}>{role === "POSTER" ? "Share a notice with your college, or ask appointed Helpers for private support. Find saved conversations and responses below each form." : "These requests are private to the requester and appointed Helpers in your college."}</MemberIntro>
      {error && <div className="form-notice" role="alert"><p>{error}</p><button type="button" className="button button-outline button-small" onClick={refresh}>Try again</button></div>}
      <section className="member-stats" aria-label="Your activity">{(role === "POSTER" ? [["Notices posted", dashboard?.stats.noticesPosted], ["Help requests", dashboard?.stats.helpTotal], ["Awaiting a Helper", dashboard?.stats.unansweredHelp]] : [["Waiting for help", dashboard?.stats.unansweredHelp], ["Answered by you", dashboard?.stats.answeredByYou], ["College help requests", dashboard?.stats.helpTotal]]).map(([label, value]) => <div className="dashboard-stat" key={String(label)}><span>{label}</span><strong>{value ?? "—"}</strong></div>)}</section>
      {role === "POSTER" ? <>
        <nav className="member-tabs" aria-label="Poster sections">
          <button type="button" aria-pressed={tab === "notice"} aria-controls="notice-section" onClick={() => window.history.replaceState(null, "", "/poster?section=notice")}>Notice Board <span>{dashboard?.quotas.notice.remaining ?? "—"} left</span></button>
          <button type="button" aria-pressed={tab === "help"} aria-controls="help-section" onClick={() => window.history.replaceState(null, "", "/poster?section=help")}>Private Help <span>{dashboard?.quotas.help.remaining ?? "—"} left</span></button>
        </nav>
        <div id="notice-section" hidden={tab !== "notice"}>
          <PosterForm kind="notice" draft={noticeDraft} onDraft={setNoticeDraft} ready={noticeReady} quotas={dashboard?.quotas} onSaved={refresh} />
          {tab === "notice" && <section className="member-section" aria-labelledby="your-notices"><div className="member-section-heading"><h2 id="your-notices">Your notices</h2><Link href="/campus" className="text-button">Open the full notice board ↗</Link></div><ConversationFeed kind="notice" scope="mine" user={user} generation={generation} onMutation={refresh} /></section>}
        </div>
        <div id="help-section" hidden={tab !== "help"}>
          <PosterForm kind="help" draft={helpDraft} onDraft={setHelpDraft} ready={helpReady} quotas={dashboard?.quotas} onSaved={refresh} />
          {tab === "help" && <section className="member-section" aria-labelledby="your-help"><h2 id="your-help">Your private help requests</h2><ConversationFeed kind="help" user={user} generation={generation} /></section>}
        </div>
      </> : <>
        <nav className="member-tabs" aria-label="Helper queue filters">{[["unanswered", "Unanswered"], ["answered", "My replies"], ["all", "All requests"]].map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</nav>
        <section className="member-section" aria-labelledby="helper-queue"><h2 id="helper-queue">{view === "unanswered" ? "Requests waiting for a Helper" : view === "answered" ? "Conversations you’ve answered" : "Your college’s private help requests"}</h2><ConversationFeed kind="help" user={user} view={view} generation={generation} onMutation={refresh} /></section>
      </>}
    </main>
  </>;
}
