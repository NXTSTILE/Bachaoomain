# Bachaoo — deployment handoff

Updated: 2026-10-04. The user supplied Turso/Brevo settings and requested backend activation and real signup testing with `240301370033@centurionuniv.edu.in`. Database setup and deployment configuration are complete. Email delivery from Vercel is currently blocked by Brevo IP restrictions; no OTP has been sent successfully.

## Latest activation state (takes precedence over older notes below)

- Production URL: https://bachaoo.vercel.app. Latest READY deployment: `dpl_D5GF22DkgmrGP4efM5wxEX43NZhx`, immutable https://bachaoo-az8gnn9n2-bookly.vercel.app, inspector https://vercel.com/bookly/bachaoo/D5GF22DkgmrGP4efM5wxEX43NZhx.
- Testing preview: `dpl_5ZZJosAgshMGFbiuWQNPKg7iyG9C`, https://bachaoo-p5jwmh3cn-bookly.vercel.app. Preview has Vercel deployment authentication; use `vercel curl` for authorized probes. The CLI generated a protection bypass token privately; never print that token or forward it to other services.
- Supplied credentials were transferred from `.env.example` into ignored private `.env`; template restored to blanks. Fresh random JWT secret generated privately. Do not read/print private `.env` or put secrets into command arguments.
- The configured Turso libSQL DB was verified empty, then **two checked-in migrations** were applied. Prisma connectivity probe passed. Schema/history checks show User/Post/Reply/Otp/RateLimit/_prisma_migrations present and no unresolved history. No users have been created by these tests.
- Eight project-level variables are now saved for Preview and Production: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, SUPPORT_EMAIL, NEXT_PUBLIC_SITE_URL, REGISTRATION_OPEN, BREVO_API_KEY, BREVO_SENDER_EMAIL. Secrets are sensitive/encrypted. Production registration is **false**; preview registration is **true** for the protected real signup test. Both currently use the supplied new database.
- `scripts/configure-vercel.ts` configures settings via secret stdin. Preview requires an explicit empty positional branch argument; without it Vercel prompts for a branch and can exit 0 without saving. Script now handles this and checks actual CLI save confirmation. For later full activation use `npx tsx scripts/configure-vercel.ts production --open` only after real email verification succeeds, then redeploy without an explicit registration-false deployment override.
- The shell exports stale `DATABASE_URL=file:./dev.db`. Use `DOTENV_CONFIG_OVERRIDE=true` with dotenv-based scripts for actual private `.env` values. The Vercel configuration script explicitly overrides inherited env values.
- Latest read-only local service preflight **passes** Brevo credentials and active sender. Earlier local HTTP 401 was diagnosed as IP blocking, not evidence that the key itself was invalid. Current testing-machine outbound IP obtained from ipify: `49.37.117.53`.
- Real Vercel `/api/auth/register` calls for the supplied college email still return 503. Sanitized runtime logs confirm Brevo returns **401 / IP_ACCESS_DENIED**, most recently at 08:39 UTC. User needs Brevo Security → Authorized IPs configured to allow Vercel's changing outbound API traffic. Documentation: https://developers.brevo.com/docs/ip-security. Account settings cannot be changed using an API key while those calls are blocked.
- There have been **three failed mail signup attempts** in the per-email hourly budget. Do not repeatedly resend. Once IP access works, observe Retry-After if throttled; a resend also has a one-minute delay. Failed delivery leaves no usable OTP challenge. Never fabricate, bypass, or issue a session without email verification.
- Production checks passed: login form is now active; valid-format nonexistent-account login returns 401 (DB path reached), protected dashboard/posts APIs return 401, signup remains explicitly closed. Email/signup/member flows remain incomplete. No OTP can be requested from the user until provider acceptance/delivery is confirmed.
- Email errors now log only status and safe classification, never recipient/OTP/key/raw body. Full existing **39-test** suite passed; added sensitive-provider-error regression passed separately; backend TypeScript and targeted lint passed; clean Vercel build/TypeScript passed.
- User additionally requested an explanation of how to test. Describe signup with their college email/name/year/password/role, OTP verification, role dashboard, asking/replying with a second independently verified senior account, reload persistence, login/logout. State clearly that signup activation is waiting on the provider restriction.

## Current deployment and next action

- Production URL: **https://bachaoo.vercel.app**.
- Latest deployment: `dpl_5u5XLqP7WHXAJsfJaEoviatCqwds`, target **production**, status **Ready**.
- Immutable URL: https://bachaoo-54y0xl6es-bookly.vercel.app.
- Inspector: https://vercel.com/bookly/bachaoo/5u5XLqP7WHXAJsfJaEoviatCqwds.
- Deployed from the existing working tree using `vercel deploy --yes --prod`; no commit or push was requested or made.
- Supplied deployment-scoped runtime/build settings: `REGISTRATION_OPEN=false`, `SUPPORT_EMAIL=bachaoo.campusconnect@gmail.com`, `NEXT_PUBLIC_SITE_URL=https://bachaoo.vercel.app`. No secret credentials were uploaded. Vercel project-level environment settings were empty at the pre-deployment check; deployment-scoped settings must be preserved in later deployments or added to the project's intended environment.
- The user chose **Need Turso setup** and supplied the public support contact above, which is also configured in local `.env`. Ask for confirmation that a libSQL preview URL/token has been configured privately; do not ask again for the support address. Then apply the checked-in Turso migrations to the intended preview DB and configure fresh JWT/Brevo settings privately for Vercel. Actual database connectivity and real email delivery remain unverified.
- Auth now returns role destinations (`/poster`, `/helper`, `/campus` for admins). `/poster` and `/helper` are real database-backed dashboards with server-side fresh-role checks. `GET /api/dashboard` returns scoped counters and bounded own/waiting/contribution lists. A helper's first reply moves a question from waiting to contributions. The campus board links to the current role dashboard.
- Local verification: lint, TypeScript/backend TypeScript, production build, **39 backend tests**, isolated production-server browser member flows for both dashboards, responsive/accessibility checks, and production-only dependency audit passed. Full audit currently has five high findings in the development lint glob chain (`braces` advisory, no patched release); README documents this.
- Live verification: Vercel clean install/build and alias inspection passed; browser smoke checks at 360/390/768/1440px passed. `/poster`, `/helper`, `/campus` redirect anonymous visitors to `/join`; `/api/dashboard`, `/api/me`, `/api/posts` return 401/no-store; register/verify remain 503 while closed; privacy/community publish the supplied support contact.

## Archived 2026-10-02 handoff

Saved: 2026-10-02 (UTC). User explicitly asked to stop for today and resume when they ask to continue. Do not make more deployments or activate registration until work is resumed.

## Goal and next action

Finish activating the campus application safely. The public site is deployed, but production signup/login cannot operate without real external services. **First action on resume:** read this handoff and `README.md`, check for intervening working-tree/deployment changes, then ask for the real monitored support address and whether the user already owns a Turso database. Credentials belong in Vercel/private environment settings, not chat or committed files.

## Repository / preservation

- Project: `/mnt/c/Users/marth/.gemini/antigravity/scratch/typescript_project`.
- Branch: `main`; HEAD remains `71dc7ca` (`Initial commit`). No commit or push was made.
- The repository already had extensive modified/untracked application work before this session. Preserve it. The complete app/backend, Prisma files, tests, Vercel config and other directories are still partly untracked; **a reset, clean, or redeploy from HEAD would discard/omit substantial work**.
- CLI deployments uploaded the working tree, not merely committed files. Before a future Git-based deployment, review and commit the intended source/config/migrations without secrets or private agent notes.
- Follow `AGENTS.md`; consult installed Next.js docs before changes. Node.js 24, Next.js 16.3.8, Prisma 7.10.0, npm.

## Actual deployed state

- Public production alias: **https://bachaoo.vercel.app**.
- Latest verified deployment: `dpl_3suhgWmAP98oJMpssQCkLGUm9Nez`.
- Immutable URL: https://bachaoo-42t219f70-bookly.vercel.app.
- Inspector: https://vercel.com/bookly/bachaoo/3suhgWmAP98oJMpssQCkLGUm9Nez.
- Linked Vercel project: `bookly/bachaoo`; existing CLI authentication worked in this session. Do not copy authentication files into the project.
- Last deploy command: `vercel deploy --yes --prod --env REGISTRATION_OPEN=false --build-env REGISTRATION_OPEN=false`.
- Registration is explicitly CLOSED. Join/login show a pilot setup notice because production services are absent. Direct register/verify API calls return 503; unauthenticated private APIs return 401 and `/campus` redirects to `/join`.
- `vercel env ls` initially reported no project environment variables. No real JWT, email or database credentials were uploaded; only deployment-scoped `REGISTRATION_OPEN=false` was supplied. No remote database was created or migrated; no real verification email was sent.
- Important deployment lesson: the first `vercel deploy --yes` unexpectedly targeted production and assigned the public alias despite no `--prod` flag. The user was informed; the final verified gated release was deliberately deployed with `--prod`. Use explicit `--target=preview` for future previews and verify reported target/aliases.

## Completed fixes (this session)

- `package.json`, `package-lock.json`: Node 24 engine, extra check/browser/preflight scripts, narrow dependency overrides (`@prisma/config` -> `deepmerge-ts@8.0.2`, `prisma` -> `mysql2@3.24.5`). Kept Prisma 7; do not apply the audit tool's breaking downgrade. Reinstall restored the missing Unix Next launcher.
- `test_prisma.ts`: replaced obsolete OTP-inserting scratch code with explicitly opted-in, read-only connectivity probe; no raw error/data logging. The separate pre-existing `test_brevo.ts` remains an unsafe real-email scratch script: do not run it.
- `src/components/brand.tsx`: fixed internal navigation lint failure.
- `src/lib/rate-limit.ts`, auth register/login/verify routes: validated trusted Vercel IP identity, fail-closed unsupported production ingress, shared-campus budgets (registration 300/IP/hour, login 600/IP/15min, verification 300/IP/10min) while retaining per-email limits. `AUTH_LOCAL_TESTING=1` is only for loopback-bound test servers; NEVER deploy that flag publicly.
- `src/lib/password-validation.ts`, `src/lib/http.ts`, `src/components/auth-form.tsx`: shared 8-character/72-UTF-8-byte contract, validation before OTP request, preserve the live challenge when correcting details.
- `src/lib/posts.ts`, `src/app/api/posts/[id]/replies/route.ts`, `src/components/campus-board.tsx`: newest 10-reply feed previews, scoped counts, 20-reply cursor pages and Load older replies UI. College/cursor isolation tested. History invalidates when latest reply/count changes; unknown study years render honestly.
- `src/lib/deployment.ts`, `scripts/check-deployment.ts`, `src/components/service-gate.tsx`, join/login pages, register/verify routes: production signup fails closed unless all configuration checks and explicit launch switch pass; enforcement is server-side. Pausing registrations/email unavailability does not itself lock out existing members with working DB/session config.
- Privacy/community pages: publish only a validated real `SUPPORT_EMAIL`, otherwise explain closed onboarding; no fabricated operator contact. They and auth gates are dynamically rendered.
- `src/app/globals.css`: fixed real 768px homepage overflow from the rotated demo card/sticker.
- `.env.example`, `README.md`: environment template, deployment/preflight/operations/runbook instructions; don't confuse presence checks with proven services.
- `tests/backend.test.ts`, new backend deployment/feed tests, `tests/backend.tsconfig.json`, `tests/browser-server.ts`, `tests/browser-smoke.mjs`: regression tests and an isolated production-server browser runner. Fixed the smoke test's obsolete exact-text FAQ selector.

## Verification evidence (final working tree / deployed release, 2026-10-02)

PASSED:
- `npm run lint`.
- `npm run typecheck`.
- `npm run typecheck:backend`.
- `npm test`: **37/37 passed**. Mocked mail and disposable SQLite/libSQL fixtures; not proof of real remote mail/database operation.
- `npm run build`: complete local production build, TypeScript and prerendering passed.
- Vercel's clean `npm ci` + `npm run build`: passed on both deployments; latest reported READY.
- `npm audit --audit-level=high`: **0 vulnerabilities reported**, including Vercel's clean install audit.
- `git diff --check`.
- `LD_LIBRARY_PATH=/tmp/bachaoo-browser-libs/usr/lib/x86_64-linux-gnu npm run test:browser:local`: responsive 360/390/768/1440px, automated WCAG A/AA, routes/assets/metadata, blocked signup bypasses; real login, older replies, posting/replying, reload, logout, and DB persistence against an ISOLATED fixture database.
- `LD_LIBRARY_PATH=/tmp/bachaoo-browser-libs/usr/lib/x86_64-linux-gnu TEST_BASE_URL=https://bachaoo.vercel.app TEST_PILOT=1 npm run test:browser`: final LIVE responsive, accessibility, public route and closed-onboarding checks passed.
- Live HTTP probes: public pages/assets 200; security headers present; no localhost canonical metadata; join/login had no collecting forms; register/verify 503; private posts 401 with no-store; campus 307 to join.

EXPECTED NOT READY:
- `npm run check:deployment` against the current local config reported missing hosted database, support contact, HTTPS public origin and registration flag. Local session/mail config was present (values never printed). This is a configuration-presence check, not an external-service test. Vercel provides its own production hostname fallback.
- Actual Turso connectivity/migration state, real college-mailbox delivery, live authenticated campus flow, operator reporting/privacy/recovery procedures: NOT verified/activated.
- Automated accessibility checks are not a full manual accessibility audit.

Useful resolved failures: original build had missing Next launcher plus stale `prisma` import in `test_prisma.ts`; original audit had four high findings; original browser setup lacked Linux shared libraries, then found a selector mismatch and genuine tablet overflow. All corresponding final checks passed after fixes.

## Browser tools and machine state

- Optional Playwright/axe packages: `/tmp/bachaoo-browser-tools` (not app dependencies).
- Browser install: `/home/marthbachaoo/.cache/ms-playwright/`.
- This WSL image lacked `libnspr4`, `libnss3`, and `libasound2t64`. Packages were downloaded with apt and extracted to `/tmp/bachaoo-browser-libs`, WITHOUT changing global installed packages. Set `LD_LIBRARY_PATH` as above for local Chromium tests. `/tmp` files may vanish on reboot; reinstall/download them if needed.
- Install/recreate tools as documented in README; if needed, in `/tmp/bachaoo-browser-libs`, `apt-get download libnspr4 libnss3 libasound2t64`, then extract each `.deb` using `dpkg-deb -x`.
- No background build/test/server or sub-agent remains running. No listeners on 3000, 3100 or 3210 at closeout. Browser runners cleaned up their temporary databases and servers. The Vercel site remains online.

## Remaining activation sequence

1. Confirm monitored `SUPPORT_EMAIL`, accountable operator and actual reporting/privacy/removal/recovery processes. Do not invent contact information or claim these services already exist.
2. Confirm/provision a Turso database in the user's chosen account; privately configure URL/token. Use a separate preview DB for real end-to-end testing. Obtain required account access/approval for provisioning; do not silently create paid resources.
3. Review the intended target and backup/history before `npm run db:migrate:turso`. Never use SQLite `prisma migrate deploy` against remote libSQL, reset a DB, or run destructive test fixtures on production.
4. Configure proper production JWT secret and Brevo credentials/verified sender in Vercel. Set intended HTTPS origin (or retain verified Vercel hostname fallback). Do not upload local credentials blindly or expose them in logs/chat.
5. Verify actual supported-college mailbox delivery and preview signup -> verification -> login -> post/reply -> reload -> logout. Ensure support operations and backup/restore plan are real.
6. Run readiness checks against intended production configuration. Only then enable `REGISTRATION_OPEN=true` and redeploy. Do not inadvertently keep supplying deployment-level `--env REGISTRATION_OPEN=false` when deliberately opening the pilot.

User's next message may simply be “continue”. Resume from external-service/support setup, not from rebuilding the already completed website.
