"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COLLEGES, POST_CATEGORIES } from "@/lib/colleges";
import { ClientApiError, displayError, requestJson } from "@/lib/client-api";
import { Brand } from "./brand";
import { clearSessionDrafts, useSessionDraft } from "./session-draft";

export { ClientApiError, displayError, requestJson } from "@/lib/client-api";
export type MemberProfile = { id: string; name: string; role: string; collegeId: string; studyYear: number | null };
export type Author = Pick<MemberProfile, "id" | "name" | "role" | "studyYear">;
export type Reply = { id: string; content: string; createdAt: string; author: Author };
export type Conversation = { id: string; title: string; content: string; category: string; createdAt: string; author: Author; replies: Reply[]; _count: { replies: number } };
export type Quotas = { day: string; timezone: string; resetAt: string; notice: { remaining: number }; help: { remaining: number } };

export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
export function roleLabel(role: string) { return role === "ADMIN" ? "Admin" : role === "HELPER" ? "Appointed Helper" : "Poster"; }
function replyDraft(value: unknown): value is string { return typeof value === "string" && value.length <= 3000; }

export function MemberHeader({ user, active }: { user: MemberProfile; active: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function logout() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
      clearSessionDrafts(); router.replace("/login"); router.refresh();
    } catch (err) { setError(displayError(err)); busy.current = false; setPending(false); }
  }
  const home = user.role === "ADMIN" ? "/superadmin" : user.role === "HELPER" ? "/helper" : "/poster";
  return <header className="member-header">
    <div className="wrap member-header-top"><Brand /><div className="member-account"><span>{user.name}</span><button type="button" className="button button-outline button-small" disabled={pending} onClick={logout}>{pending ? "Signing out…" : "Log out"}</button></div></div>
    <nav className="wrap member-navigation" aria-label="Member navigation">
      <Link href={home} aria-current={active === "dashboard" ? "page" : undefined}>{user.role === "ADMIN" ? "Admin page" : "My dashboard"}</Link>
      <Link href="/campus" aria-current={active === "board" ? "page" : undefined}>Notice board</Link>
      <Link href="/community">Community rules</Link>
    </nav>
    {error && <p className="form-notice wrap" role="alert">{error}</p>}
  </header>;
}

export function MemberIntro({ user, label, title, children }: { user: MemberProfile; label: string; title: string; children: ReactNode }) {
  return <section className="member-intro">
    <div><p className="eyebrow">{label}</p><h1>{title}</h1><p>{children}</p></div>
    <div className="member-profile"><span className={`avatar ${user.role === "HELPER" ? "avatar-purple" : "avatar-peach"}`} aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><small>{roleLabel(user.role)} · {user.studyYear ? `Year ${user.studyYear}` : "Year not shared"}</small><small>{COLLEGES.find(college => college.id === user.collegeId)?.name || "Your college"}</small></div></div>
  </section>;
}

export function ConversationCard({ item, kind, userId, allowReply, onUpdate }: { item: Conversation; kind: "notice" | "help"; userId: string; allowReply: boolean; onUpdate: (saved?: boolean) => Promise<void> }) {
  const router = useRouter();
  const version = `${item.replies[0]?.id || "empty"}:${item._count.replies}`;
  const [history, setHistory] = useState<{ version: string; rows: Reply[]; more: boolean } | null>(null);
  const [text, setText, draftReady] = useSessionDraft(`${userId}:${kind}:reply:${item.id}`, "", replyDraft);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [olderPending, setOlderPending] = useState(false);
  const busy = useRef(false);
  const historyBusy = useRef(false);
  const current = history?.version === version ? history : null;
  const replies = current?.rows || item.replies;
  const more = current ? current.more : item._count.replies > replies.length;
  const path = kind === "help" ? `/api/help-requests/${encodeURIComponent(item.id)}/replies` : `/api/notice-board/${encodeURIComponent(item.id)}/replies`;
  async function failure(err: unknown) {
    setError(displayError(err));
    if (err instanceof ClientApiError && [401, 403, 404].includes(err.status)) { setHistory(null); await onUpdate(false); router.refresh(); }
  }
  async function older() {
    if (historyBusy.current || !replies.length) return;
    historyBusy.current = true; setOlderPending(true); setError("");
    try {
      const result = await requestJson<{ replies: Reply[]; nextCursor: string | null }>(`${path}?before=${encodeURIComponent(replies.at(-1)!.id)}`);
      setHistory({ version, rows: [...replies, ...result.replies], more: result.nextCursor !== null });
    } catch (err) { await failure(err); }
    finally { historyBusy.current = false; setOlderPending(false); }
  }
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || !draftReady) return;
    busy.current = true; setPending(true); setError(""); setNotice("");
    try {
      if (text.trim().length < 2) throw new Error("Write at least 2 characters for your reply.");
      await requestJson(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) });
      setText(""); setNotice("Reply saved."); await onUpdate(true);
    } catch (err) { await failure(err); }
    finally { busy.current = false; setPending(false); }
  }
  return <article className="post-card">
    <div className="post-body">
      <div className="conversation-meta"><span className="post-category">{item.category}</span><span className={`visibility-tag ${kind === "help" ? "private-tag" : ""}`}>{kind === "help" ? "Private help" : "College notice"}</span>{kind === "help" && <span className="request-status">{item._count.replies ? "Helper replied" : "Awaiting a Helper"}</span>}</div>
      <h3>{item.title}</h3><p className="post-text">{item.content}</p>
      <div className="conversation-author"><strong>{item.author.name}</strong><span>{roleLabel(item.author.role)} · <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></span></div>
    </div>
    <details className="replies">
      <summary>{item._count.replies} {item._count.replies === 1 ? "reply" : "replies"} · {kind === "help" ? "Helper responses" : "Open conversation"}</summary>
      {error && <p className="form-notice" role="alert">{error}</p>}{notice && <p className="form-notice success-notice" role="status">{notice}</p>}
      {more && <button type="button" className="button button-outline button-small older-replies" disabled={olderPending} onClick={older}>{olderPending ? "Loading…" : "Load older replies"}</button>}
      {!replies.length && <p className="help-readonly">{kind === "help" ? "No Helper responses yet. Check back here for a reply." : "No replies yet. Start the conversation."}</p>}
      <ol className="reply-list">{[...replies].reverse().map(row => <li className="reply-item" key={row.id}><div className="conversation-author"><strong>{row.author.name}</strong><span>{kind === "help" ? "Helper response" : roleLabel(row.author.role)} · <time dateTime={row.createdAt}>{dateLabel(row.createdAt)}</time></span></div><p className="post-text">{row.content}</p></li>)}</ol>
      {allowReply ? <form className="reply-form" onSubmit={reply} aria-busy={pending}>
        <div className="field"><label htmlFor={`${kind}-reply-${item.id}`}>{kind === "help" ? "Your Helper reply" : "Write a notice reply"}</label><textarea id={`${kind}-reply-${item.id}`} required minLength={2} maxLength={3000} rows={3} disabled={pending || !draftReady} value={text} onChange={event => setText(event.target.value)} aria-describedby={`${kind}-reply-hint-${item.id}`} /><small id={`${kind}-reply-hint-${item.id}`}>{kind === "help" ? "Only the requester and appointed college Helpers can read this response." : "Your college community can read this reply."} {text.length.toLocaleString("en-IN")}/3,000 characters.</small></div>
        <button type="submit" className="button button-dark button-small" disabled={pending || !draftReady}>{pending ? "Saving reply…" : "Post reply ↗"}</button>
      </form> : <p className="help-readonly">This is your private conversation. Only appointed Helpers can write responses.</p>}
    </details>
  </article>;
}

type FeedPage = { posts?: Conversation[]; requests?: Conversation[]; nextCursor: string | null };
type FeedSnapshot = { url: string; revision: string; items: Conversation[]; cursor: string | null; error: string };

export function ConversationFeed({ kind, user, view = "all", scope = "college", generation = 0, onMutation }: { kind: "notice" | "help"; user: MemberProfile; view?: string; scope?: "college" | "mine"; generation?: number; onMutation?: () => Promise<void> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [category, setCategory] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState<{ url: string; text: string } | null>(null);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const path = kind === "notice" ? "/api/notice-board" : "/api/help-requests";
  const url = `${path}?q=${encodeURIComponent(query)}${kind === "help" ? `&view=${encodeURIComponent(view)}` : `&scope=${scope}&category=${encodeURIComponent(category)}`}`;
  const revision = `${refresh}:${generation}`;
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(null);
  const current = snapshot?.url === url ? snapshot : null;
  const loading = current?.revision !== revision;
  const searchId = `search-${kind}-${scope}-${view}`;
  useEffect(() => {
    const controller = new AbortController();
    requestJson<FeedPage>(url, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSnapshot({ url, revision, items: data.posts || data.requests || [], cursor: data.nextCursor, error: "" }); })
      .catch(err => {
        if (controller.signal.aborted) return;
        const forbidden = err instanceof ClientApiError && [401, 403].includes(err.status);
        setSnapshot(previous => ({ url, revision, items: !forbidden && previous?.url === url ? previous.items : [], cursor: !forbidden && previous?.url === url ? previous.cursor : null, error: displayError(err) }));
        if (forbidden) router.refresh();
      });
    return () => controller.abort();
  }, [url, revision, router]);
  useEffect(() => {
    function update() { if (document.visibilityState === "visible") setRefresh(value => value + 1); }
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  async function changed(saved = true) {
    setMessage(saved ? "Reply saved. The conversation is up to date." : "");
    setRefresh(value => value + 1);
    if (onMutation) await onMutation();
  }
  async function more() {
    if (busy.current || loading || !current?.cursor) return;
    busy.current = true; setPaging(true); setPageError(null);
    try {
      const data = await requestJson<FeedPage>(`${url}&before=${encodeURIComponent(current.cursor)}`);
      setSnapshot(previous => previous?.url === url && previous.revision === revision ? { ...previous, items: [...previous.items, ...(data.posts || data.requests || []).filter(item => !previous.items.some(existing => existing.id === item.id))], cursor: data.nextCursor } : previous);
    } catch (err) {
      setPageError({ url, text: displayError(err) });
      if (err instanceof ClientApiError && [401, 403].includes(err.status)) { setSnapshot({ url, revision, items: [], cursor: null, error: displayError(err) }); router.refresh(); }
    } finally { busy.current = false; setPaging(false); }
  }
  function retry() { setPageError(null); setRefresh(value => value + 1); }
  return <div>
    <form className="feed-toolbar" onSubmit={event => { event.preventDefault(); setQuery(draftQuery.trim()); setRefresh(value => value + 1); setPageError(null); setMessage(""); }}>
      <label className="sr-only" htmlFor={searchId}>Search {scope === "mine" ? "your " : ""}{kind === "notice" ? "notices" : "help requests"}</label>
      <input className="search-input" id={searchId} type="search" maxLength={160} placeholder={kind === "notice" ? scope === "mine" ? "Search your saved notices…" : "Search your college notices…" : "Search private help requests…"} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} />
      <button type="submit" className="button button-outline button-small">Search</button>
      <button type="button" className="button button-outline button-small" disabled={loading} onClick={retry}>{loading ? "Refreshing…" : "Refresh"}</button>
    </form>
    {kind === "notice" && <div className="feed-filters field"><label htmlFor={`${searchId}-category`}>Filter by topic</label><select id={`${searchId}-category`} value={category} onChange={event => { setCategory(event.target.value); setPageError(null); setMessage(""); }}><option value="">All topics</option>{POST_CATEGORIES.map(topic => <option key={topic}>{topic}</option>)}</select></div>}
    {(query || category) && <div className="feed-summary"><span>{query ? `Results for “${query}”` : "Filtered notices"}{category ? ` · ${category}` : ""}</span><button type="button" className="text-button" onClick={() => { setDraftQuery(""); setQuery(""); setCategory(""); setPageError(null); setMessage(""); }}>Clear filters</button></div>}
    {message && <p className="form-notice success-notice" role="status">{message}</p>}
    {current?.error && <div className="form-notice" role="alert"><p>{current.error}</p><button type="button" className="button button-outline button-small" disabled={loading} onClick={retry}>Try again</button></div>}
    {!current ? <p className="loading-state" role="status">Loading {kind === "notice" ? "notices" : "help requests"}…</p> : <div aria-busy={loading}>
      {loading && <p className="field-hint" role="status">Updating conversations…</p>}
      {current.items.length ? <><div className="post-list">{current.items.map(item => <ConversationCard key={item.id} item={item} kind={kind} userId={user.id} allowReply={kind === "notice" || user.role === "HELPER"} onUpdate={changed} />)}</div>{current.cursor && <button className="button button-outline load-more" type="button" disabled={paging || loading} onClick={more}>{paging ? "Loading…" : "Load more"}</button>}</> : !current.error && <div className="empty-feed"><h3>{query || category ? "No matching conversations." : kind === "notice" ? scope === "mine" ? "No notices yet." : "Your college notice board starts here." : "No help requests in this view."}</h3><p>{kind === "notice" ? scope === "mine" ? "Your published notices and their replies will appear here. Use the form above to share your first notice." : "Posters can publish one notice each day. Every college member can reply." : user.role === "HELPER" ? "Requests will appear when a Poster needs help. Try the All requests tab for answered conversations." : "Use the Help Form to reach appointed college Helpers. Your request stays off the common board."}</p></div>}
    </div>}
    {pageError?.url === url && <p className="form-notice" role="alert">{pageError.text}</p>}
  </div>;
}
