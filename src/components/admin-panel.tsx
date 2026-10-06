"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, MemberHeader, MemberIntro, dateLabel, displayError, requestJson, roleLabel, type MemberProfile } from "./member-ui";

type ManagedUser = MemberProfile & { email: string; helperAssignedAt: string | null };
type Audit = { id: string; action: string; oldRole: string; newRole: string; createdAt: string; actor: { name: string }; target: { name: string } };
type Snapshot = { query: string; version: number; users: ManagedUser[]; cursor: string | null; entries: Audit[]; error: string };

export function AdminPanel({ user }: { user: MemberProfile }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [chosen, setChosen] = useState<ManagedUser | null>(null);
  const [pending, setPending] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const pagingBusy = useRef(false);
  const confirmationRef = useRef<HTMLElement>(null);
  const originRef = useRef<HTMLButtonElement | null>(null);
  function closeConfirmation() {
    if (!chosen) return;
    setChosen(null);
    requestAnimationFrame(() => originRef.current?.focus());
  }
  useEffect(() => {
    if (!chosen) return;
    confirmationRef.current?.focus();
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy.current) { setChosen(null); originRef.current?.focus(); }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [chosen]);
  const current = snapshot?.query === query ? snapshot : null;
  const loading = current?.version !== version;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([requestJson<{ users: ManagedUser[]; nextCursor: string | null }>(`/api/admin/users?q=${encodeURIComponent(query)}`, { signal: controller.signal }), requestJson<{ entries: Audit[] }>("/api/admin/audit", { signal: controller.signal })])
      .then(([members, audit]) => { if (!controller.signal.aborted) setSnapshot({ query, version, users: members.users, cursor: members.nextCursor, entries: audit.entries, error: "" }); })
      .catch(err => {
        if (controller.signal.aborted) return;
        const forbidden = err instanceof ClientApiError && [401, 403].includes(err.status);
        setSnapshot(previous => ({ query, version, users: !forbidden && previous?.query === query ? previous.users : [], cursor: !forbidden && previous?.query === query ? previous.cursor : null, entries: !forbidden && previous?.query === query ? previous.entries : [], error: displayError(err) }));
        if (forbidden) router.refresh();
      });
    return () => controller.abort();
  }, [query, version, router]);
  async function changeRole() {
    if (!chosen || busy.current) return;
    busy.current = true; setPending(true); setError(""); setNotice("");
    try {
      const result = await requestJson<{ user: ManagedUser }>(`/api/admin/users/${encodeURIComponent(chosen.id)}/helper`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: chosen.role !== "HELPER", expectedRole: chosen.role }) });
      setSnapshot(previous => previous ? { ...previous, users: previous.users.map(member => member.id === result.user.id ? result.user : member) } : previous);
      setNotice(chosen.role === "HELPER" ? "Helper appointment revoked. Private help access is removed immediately." : "Helper appointed. They can use their existing login to access the Helper dashboard.");
      closeConfirmation(); setVersion(value => value + 1);
    } catch (err) {
      setError(displayError(err));
      if (err instanceof ClientApiError && [409, 404].includes(err.status)) { closeConfirmation(); setVersion(value => value + 1); }
      if (err instanceof ClientApiError && [401, 403].includes(err.status)) { setSnapshot(null); setChosen(null); router.refresh(); }
    } finally { busy.current = false; setPending(false); }
  }
  async function more() {
    if (!current?.cursor || loading || pagingBusy.current) return;
    pagingBusy.current = true; setPaging(true); setError("");
    try {
      const data = await requestJson<{ users: ManagedUser[]; nextCursor: string | null }>(`/api/admin/users?q=${encodeURIComponent(query)}&before=${encodeURIComponent(current.cursor)}`);
      setSnapshot(previous => previous?.query === query && previous.version === version ? { ...previous, users: [...previous.users, ...data.users.filter(member => !previous.users.some(existing => existing.id === member.id))], cursor: data.nextCursor } : previous);
    } catch (err) { setError(displayError(err)); if (err instanceof ClientApiError && [401, 403].includes(err.status)) { setSnapshot(null); setChosen(null); router.refresh(); } }
    finally { pagingBusy.current = false; setPaging(false); }
  }
  return <>
    <MemberHeader user={user} active="dashboard" />
    <main id="main-content" className="member-layout wrap">
      <MemberIntro user={user} label="Admin management" title="Appoint the people who can help.">Manage verified college members. Helper access is granted here, saved in the database and recorded in an audit trail.</MemberIntro>
      {notice && <p className="form-notice success-notice" role="status">{notice}</p>}{error && <p className="form-notice" role="alert">{error}</p>}
      <section className="member-section" aria-labelledby="admin-users-heading">
        <h2 id="admin-users-heading">Verified members</h2>
        <form className="feed-toolbar" onSubmit={event => { event.preventDefault(); setQuery(draftQuery.trim()); setVersion(value => value + 1); closeConfirmation(); setError(""); }}>
          <label className="sr-only" htmlFor="admin-search">Search verified members</label><input id="admin-search" className="search-input" type="search" maxLength={100} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="Search name or registered email…" />
          <button className="button button-outline button-small" type="submit">Search</button><button className="button button-outline button-small" type="button" disabled={loading} onClick={() => { closeConfirmation(); setVersion(value => value + 1); }}>{loading ? "Refreshing…" : "Refresh"}</button>
        </form>
        {query && <div className="feed-summary"><span>Results for “{query}”</span><button type="button" className="text-button" onClick={() => { setDraftQuery(""); setQuery(""); closeConfirmation(); }}>Clear search</button></div>}
        {current?.error && <div className="form-notice" role="alert"><p>{current.error}</p><button type="button" className="button button-outline button-small" disabled={loading} onClick={() => setVersion(value => value + 1)}>Try again</button></div>}
        {!current ? <p className="loading-state" role="status">Loading verified members…</p> : <div aria-busy={loading}>
          {loading && <p className="field-hint" role="status">Updating members and role changes…</p>}
          {current.users.length ? <div className="admin-member-list">{current.users.map(member => <article className="admin-member" key={member.id}><div><h3>{member.name}</h3><p>{member.email}</p><small>{roleLabel(member.role)} · {member.studyYear ? `Year ${member.studyYear}` : "Year not shared"}{member.helperAssignedAt ? ` · Appointed ${dateLabel(member.helperAssignedAt)}` : ""}</small></div><button type="button" className={`button button-small ${member.role === "HELPER" ? "button-outline" : "button-dark"}`} disabled={pending || loading} onClick={event => { originRef.current = event.currentTarget; setChosen(member); setError(""); }}>{member.role === "HELPER" ? "Revoke Helper" : "Assign Helper"}</button></article>)}</div> : !current.error && <div className="empty-feed"><h3>{query ? "No matching members." : "No eligible members yet."}</h3><p>{query ? "Try another name or registered college email." : "Verified Posters will appear here after joining your college."}</p></div>}
          {current.cursor && <button type="button" className="button button-outline load-more" disabled={paging || loading} onClick={more}>{paging ? "Loading…" : "Load more members"}</button>}
        </div>}
      </section>
      {chosen && <section ref={confirmationRef} tabIndex={-1} className="admin-confirm" aria-labelledby="role-confirm-title" aria-busy={pending}>
        <h2 id="role-confirm-title">{chosen.role === "HELPER" ? "Revoke Helper appointment?" : "Appoint this member as Helper?"}</h2><p>{chosen.name} · {chosen.email}</p><p>{chosen.role === "HELPER" ? "They will return to the Poster dashboard and lose access to other members’ private help requests." : "They will be able to read and reply to private help requests from this college. Their login credentials stay the same."}</p>
        <div className="inline-actions"><button className="button button-dark" type="button" disabled={pending} onClick={changeRole}>{pending ? "Saving…" : "Confirm role change"}</button><button className="button button-outline" type="button" disabled={pending} onClick={closeConfirmation}>Cancel</button></div>
      </section>}
      <section className="member-section" aria-labelledby="role-audit-title"><h2 id="role-audit-title">Recent role changes</h2>
        {!current ? <p className="field-hint" role="status">Loading role changes…</p> : current.entries.length ? <ol className="audit-list">{current.entries.map(entry => <li key={entry.id}><strong>{entry.target.name}</strong><span>{roleLabel(entry.oldRole)} → {roleLabel(entry.newRole)}</span><small>By {entry.actor.name} · <time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}, {new Date(entry.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST</time></small></li>)}</ol> : !current.error && <p className="field-hint">Saved appointments and revocations will appear here.</p>}
      </section>
    </main>
  </>;
}
