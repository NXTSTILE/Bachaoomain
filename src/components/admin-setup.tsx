"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { displayError, requestJson } from "./member-ui";
import { passwordInput } from "@/lib/password-validation";

export function AdminSetup() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    const invitation = new URLSearchParams(window.location.hash.slice(1)).get("invite") || "";
    // The invitation stays in the fragment and memory, never local storage or logs.
    Promise.resolve().then(() => { if (active) setToken(invitation); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      passwordInput(password, true);
      if (password !== confirmation) throw new Error("Passwords do not match.");
      const result = await requestJson<{ redirectTo: string }>("/api/admin/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, password }) });
      window.history.replaceState(null, "", window.location.pathname);
      setToken(""); setPassword(""); setConfirmation("");
      router.replace(result.redirectTo); router.refresh();
    } catch (err) { setError(displayError(err)); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="auth-card"><h2>Activate your Admin account.</h2><p>This operator-issued email invitation verifies your mailbox. Choose your display name and a unique password. Invitations expire after 24 hours.</p>{!token && <p className="form-notice" role="status">Open the complete activation link from your invitation email.</p>}<form className="form-stack" onSubmit={submit} aria-busy={pending}>{error && <p className="form-notice" role="alert">{error}</p>}<div className="field"><label htmlFor="admin-name">Admin display name</label><input id="admin-name" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></div><div className="field"><label htmlFor="admin-password">Choose password</label><input id="admin-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /><small>At least 8 characters and at most 72 UTF-8 bytes.</small></div><div className="field"><label htmlFor="admin-password-confirm">Confirm password</label><input id="admin-password-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div><button className="button button-dark" type="submit" disabled={pending || !/^[a-f0-9]{64}$/.test(token)}>{pending ? "Activating…" : "Activate Admin account ↗"}</button></form></div>;
}
