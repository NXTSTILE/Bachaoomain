"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collegeEmail, loginEmail } from "@/lib/colleges";
import { MIN_SIGNUP_PASSWORD_LENGTH, passwordInput } from "@/lib/password-validation";
import { ClientApiError, displayError, requestJson } from "@/lib/client-api";

export function AuthForm({ mode, supportContact }: { mode: "join" | "login"; supportContact?: string | null }) {
  const isLogin = mode === "login";
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [studyYear, setStudyYear] = useState("1");
  const [otp, setOtp] = useState("");
  const [challengeEmail, setChallengeEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const busy = useRef(false);
  const otpRef = useRef<HTMLInputElement>(null);
  const hasChallenge = challengeEmail !== "" && challengeEmail === email.trim().toLowerCase();

  useEffect(() => {
    if (!resendAt) return;
    const timer = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  function cooldown(seconds: number) {
    setResendAt(Date.now() + seconds * 1000); setSecondsLeft(seconds);
  }

  async function submitRequest(path: string, data: Record<string, unknown>) {
    try {
      return await requestJson<{ redirectTo: string; useExistingCode?: boolean; retryAfter?: number }>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } catch (err) {
      if (path === "/api/auth/register" && err instanceof ClientApiError && err.status === 429 && err.details?.useExistingCode === true) return { useExistingCode: true, retryAfter: err.retryAfter || Number(err.details.retryAfter) || 60, redirectTo: "" };
      throw err;
    }
  }

  function validatedDetails() {
    const normalizedEmail = isLogin ? loginEmail(email) : collegeEmail(email).email;
    passwordInput(password, !isLogin);
    if (!isLogin) {
      const name = fullName.trim();
      if (name.length < 2 || name.length > 80 || name.includes("\0")) throw new Error("Full name must be 2–80 characters.");
      const year = Number(studyYear);
      if (!Number.isInteger(year) || year < 1 || year > 6) throw new Error("Study year must be an integer from 1 to 6.");
    }
    return normalizedEmail;
  }

  function continueWithCode() {
    if (busy.current) return;
    setError(""); setNotice("");
    try {
      const normalizedEmail = validatedDetails();
      setEmail(normalizedEmail); setChallengeEmail(normalizedEmail); setStep("otp");
      setNotice("Enter the code from your latest verification email. No new email was requested.");
      requestAnimationFrame(() => otpRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check your signup details and try again.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setError(""); setNotice(""); setLoading(true);
    try {
      const normalizedEmail = validatedDetails();
      if (isLogin) {
        const result = await submitRequest("/api/auth/login", { email: normalizedEmail, password });
        router.replace(result.redirectTo); router.refresh();
      } else if (step === "details") {
        let recovered = hasChallenge;
        if (!hasChallenge) {
          const result = await submitRequest("/api/auth/register", { email: normalizedEmail });
          recovered = result.useExistingCode === true;
          cooldown(result.retryAfter || 60);
          setChallengeEmail(normalizedEmail); setOtp("");
        }
        setEmail(normalizedEmail); setStep("otp");
        setNotice(recovered ? "Use the code from your newest verification email. No new email was sent." : "Code sent. Check your inbox and spam folder.");
        requestAnimationFrame(() => otpRef.current?.focus());
      } else {
        const result = await submitRequest("/api/auth/verify", { email: normalizedEmail, otp, fullName, password, studyYear: Number(studyYear) });
        router.replace(result.redirectTo); router.refresh();
      }
    } catch (err) {
      setError(displayError(err));
    } finally { setLoading(false); busy.current = false; }
  }

  async function resendCode() {
    if (busy.current || secondsLeft > 0) return;
    busy.current = true; setLoading(true); setError(""); setNotice("");
    try {
      const result = await submitRequest("/api/auth/register", { email });
      setChallengeEmail(email);
      cooldown(result.retryAfter || 60);
      if (result.useExistingCode) {
        setNotice(`Use the code from your newest email. You can request a new code in ${Math.max(1, Math.ceil(Number(result.retryAfter || 60) / 60))} minute(s).`);
      } else {
        setOtp(""); setNotice("A fresh code is on its way. Use the newest email.");
      }
    } catch (err) { setError(displayError(err)); if (err instanceof ClientApiError && err.retryAfter) cooldown(err.retryAfter); }
    finally { busy.current = false; setLoading(false); }
  }

  return (
    <div className="auth-card">
      <h2>{step === "otp" ? "Check your inbox." : isLogin ? "Good to have you back." : "Find your people."}</h2>
      <p>{step === "otp" ? `Enter the 6-digit code for ${email}. Codes expire 10 minutes after they are sent.` : isLogin ? "Your college community is right here." : "Centurion University · College-email access"}</p>
      <form onSubmit={handleSubmit} className="form-stack" aria-busy={loading}>
        {error && <div className="form-notice" role="alert">{error}</div>}
        {notice && <div className="form-notice success-notice" role="status">{notice}</div>}
        {step === "details" ? <>
          <div className="field"><label htmlFor="email">{isLogin ? "Email" : "College email"}</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder={isLogin ? "Your registered email" : "123456789012@centurionuniv.edu.in"} value={email} onChange={e => setEmail(e.target.value)} aria-describedby="email-hint" /><small id="email-hint">{isLogin ? "Use your registered college email or invited Admin email." : "Use your 12-digit student ID at centurionuniv.edu.in or cutm.ac.in."}</small></div>
          {!isLogin && <div className="field"><label htmlFor="fullName">What should we call you?</label><input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={80} placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} /></div>}
          <div className="field"><label htmlFor="password">Password</label><div className="password-control"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} required minLength={isLogin ? 1 : MIN_SIGNUP_PASSWORD_LENGTH} disabled={loading} value={password} onChange={e => setPassword(e.target.value)} aria-describedby={!isLogin ? "password-hint" : undefined} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="text-button" onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button></div>{!isLogin && <small id="password-hint">Use a unique password with at least 8 characters. Maximum 72 bytes; emoji and accented characters can use more than one byte.</small>}</div>
          {!isLogin && <>
            <div className="field"><label htmlFor="studyYear">Your current year</label><select id="studyYear" name="studyYear" value={studyYear} onChange={e => setStudyYear(e.target.value)}>{[1, 2, 3, 4, 5, 6].map(year => <option key={year} value={year}>Year {year}</option>)}</select></div>
            <p className="field-hint">You’re joining as a Poster. Helpers are appointed by the Admin. Your study year is self-declared.</p>
          </>}
        </> : <div className="field"><label htmlFor="otp">Email verification code</label><input ref={otpRef} id="otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" minLength={6} maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} className="otp-input" /></div>}
        <button className="button button-dark" type="submit" disabled={loading}>{loading ? "One moment…" : step === "otp" ? "Verify & join my college ↗" : isLogin ? "Back to my college ↗" : hasChallenge ? "Continue to verification ↗" : "Send my verification code ↗"}</button>
      </form>
      {!isLogin && step === "details" && <button type="button" disabled={loading} className="text-button" onClick={continueWithCode}>I already have a verification code →</button>}
      {step === "otp" && <div className="inline-actions"><button type="button" disabled={loading} className="text-button" onClick={() => { setStep("details"); setError(""); setNotice(""); }}>← Edit details</button><button type="button" disabled={loading || secondsLeft > 0} className="text-button" onClick={resendCode}>{secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}</button></div>}
      {!isLogin && <p className="legal-hint">By joining, you agree to the <Link href="/community">community rules</Link> and acknowledge the <Link href="/privacy">privacy notice</Link>. Notices are shared with your college. Private help is visible only to you and appointed Helpers.</p>}
      {isLogin && <p className="legal-hint">Forgot your password or need help signing in? {supportContact ? <>Email <a href={`mailto:${supportContact}`}>{supportContact}</a> from your registered address for account-access support. Never send your password or verification code.</> : <>Check the <Link href="/privacy">privacy and support information</Link> for account-access help.</>}</p>}
      <Link href={isLogin ? "/join" : "/login"} className="form-switch">{isLogin ? "New here? Find your people →" : "Already in the crew? Log in →"}</Link>
    </div>
  );
}
