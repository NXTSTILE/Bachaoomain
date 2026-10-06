# Bachaoo

A **mobile-first, college-scoped notice board and private-help platform**, initially for Centurion University. Built with Next.js 16 App Router, React 19, TypeScript, Prisma 7, and Brevo verification email. Local development uses SQLite; Vercel uses persistent Turso/libSQL storage.

## Student quick start

1. Open **Join your college** (`/join`) and use your 12-digit student email at `centurionuniv.edu.in` or `cutm.ac.in`. Enter your display name, current year and a password with at least eight characters.
2. Enter the six-digit code from your latest verification email. Check spam if needed. **I already have a verification code** resumes verification without sending another email; the resend button shows its waiting time.
3. You join as a **Poster**. Choose the right section on **My dashboard**:
   - **Notice Board** (`/poster?section=notice`): announcements, events, lost-item notices and other messages that your whole college can read and reply to.
   - **Private Help** (`/poster?section=help`): a request visible only to you and appointed college Helpers. Find Helper responses under **Your private help requests → Helper responses**.
4. Each form allows **one successful submission per day**, independently. The quota badge and next-reset date show when you can publish again: midnight IST. Reading and replying to notices do not use these publication allowances.
5. Use **Notice board** (`/campus`) to browse, search and filter college notices by topic. Your dashboard’s **Your notices** list searches and paginates your own saved notices, including older activity. **Load older replies** opens the rest of a long conversation.
6. Unsent notice, help and reply drafts survive reloads and navigation in the same browser tab. Saving or logging out removes the corresponding drafts. Closing the tab normally clears them; draft recovery depends on browser session storage being available.

Already registered? Use **Log in** (`/login`); this stays visible on small phones and remains available when new registrations are paused. The password field has a show/hide control. Account-access help uses the configured support contact shown on the login and privacy pages.

**Helpers:** an Admin must appoint your existing verified account. Sign in normally to open `/helper`, answer **Unanswered** requests, and revisit saved conversations in **My replies**. **Admins:** `/superadmin` manages appointments, revocations and the timestamped audit trail. Cancelling a role confirmation returns keyboard focus to its member action; Escape also closes it.

## Product requirements

There are **two member dashboards**: Poster and Helper. An additional **admin management page** controls who is appointed as a helper.

### Poster dashboard — `/poster`

The Poster dashboard contains two distinct forms and their corresponding activity views:

| Form | Purpose | Visibility | Daily submission limit |
| --- | --- | --- | --- |
| **Notice Board Form** | Publish a title and message to the shared college notice board | All signed-in members of the same college can read and reply | **1 notice-board post per Poster per day** |
| **Help Form** | Submit a title and details describing a request for help | The requesting Poster and admin-appointed Helpers of that college | **1 help request per Poster per day** |

**Notice Board Form**

- A saved notice appears on the common board (`/campus`) and in the Poster's notice activity.
- Any signed-in member of that college, including Posters, Helpers and Admins, can browse notices and submit replies.
- Guests cannot read notice content or replies. Other colleges cannot access it.
- The dashboard shows saved notices, reply counts, the remaining notice quota and its reset time.

**Help Form**

- A saved help request goes to the **Helper dashboard**, never to the common notice board.
- The requesting Poster can view their own help requests and read the Helpers' replies in a private activity view.
- Other Posters cannot list, search, open or reply to that request.
- Only active, admin-appointed Helpers from the same college can browse the help queue and write help replies.
- The dashboard shows the Poster's own requests, helper responses, the remaining help quota and its reset time.

The requesting Poster must be able to read the response to their own request; this does not grant access to anybody else's help requests. Help replies are restricted to Helpers. Visibility is enforced by backend queries and authorization checks, not by frontend filters.

### Helper dashboard — `/helper`

- Helpers use the regular login page after an Admin appoints them. **There is no public Helper signup or self-selection of the Helper role.**
- The dashboard displays private help requests from their own college and conversations they have answered.
- Helpers can open a request, send a reply and revisit its saved conversation.
- A request moves out of the unanswered queue after its first helper reply and remains available in the answered activity view; answering does not delete it.
- Helpers can also open the shared notice board to read and reply to notices.
- Shared notices and private help requests are separate data flows. A Helper answer to a help request must never become a notice-board reply.

### Admin management page — `/superadmin`

"Assigning a Helper" means granting the Helper role to an existing, email-verified member through the Admin page.

- Only an authenticated `ADMIN` can access the page and its role-management API.
- An Admin can select a verified Poster in their college, **assign the Helper role**, and revoke that appointment to return the member to Poster.
- Record the acting Admin, target member, college, old/new role and timestamp for each assignment or revocation.
- Role changes and the audit record must commit atomically. Existing sessions must use the new permissions immediately because authorization re-reads the database.
- The page must use persisted users and assignments, with loading, empty, error and confirmation states.
- Helper assignment does not grant Admin privileges. Public signup cannot create either Helpers or Admins.
- Provision the first Admin through the private operator CLI: promote an already verified member, or email a one-time invitation to a named operator (including an external mailbox). The invited owner verifies mailbox access and chooses a password at `/admin/setup`; Admin creation stays outside public signup.
- This role-management page does not grant a separate right to browse private help content. Private-help readers are the requesting Poster and the appointed Helpers.

### Role and access contract

| Action | Guest | Poster | Appointed Helper | Admin |
| --- | --- | --- | --- | --- |
| Public landing and authentication pages | Yes | Yes | Yes | Yes |
| Read/reply to own-college notice board | No | Yes | Yes | Yes |
| Publish through Notice Board Form | No | 1/day | No | No |
| Submit through Help Form | No | 1/day | No | No |
| Read a private help request | No | Own requests only | Own-college requests | No separate access |
| Reply to a private help request | No | No | Own-college requests | No |
| Assign/revoke Helpers | No | No | No | Verified members of own college |

### Daily posting quotas

The two form limits are **independent**. A Poster may submit one notice and one help request on the same day, for a maximum of two new submissions across the two forms.

- Define "day" as the calendar day in **`Asia/Kolkata` (IST)**; both quotas reset at midnight IST.
- Scope each quota to the authenticated user, college, form kind (`NOTICE_BOARD` or `HELP_REQUEST`) and IST day. Changing browser, device or session must not reset it.
- Enforce quotas in the backend using a persistent unique daily quota record and a transaction that saves the quota and content together. Concurrent requests and multiple Vercel instances must not publish more than one submission per form.
- Validate input and authorization before saving. Failed validation or a rolled-back content write does not consume a successful-publication quota.
- Deleting a successfully published submission does not restore that day's quota.
- A second successful-publication attempt for the same form/day returns **HTTP 429**, a clear form-specific error and `Retry-After` with the actual seconds until midnight IST.
- Show each form's remaining allowance and reset time in the UI. A disabled submit button is only a convenience; direct API requests remain subject to the same limit.
- The one-per-day quota applies to **new notices and new help requests**, not replies. Replies retain their own bounded anti-abuse limits.
- Signup/OTP/login throttles are separate from these publication quotas. A throttled verification-email request may recover an already delivered, unexpired code without sending another email or bypassing verification.

### Mobile-first experience

- Design the default layout for small screens first, with a single-column dashboard and no horizontal page scrolling at 320px and above.
- Present **Notice Board** and **Help** as clearly labelled sections or tabs on the Poster dashboard, with each form's quota visible beside it.
- Provide compact, accessible navigation between the member dashboard, notice board and account/logout controls. Enhance to a wider layout on tablet/desktop.
- Use touch targets of at least 44 × 44px, readable text, labelled inputs and keyboard-accessible controls.
- Keep forms usable when the mobile keyboard is open; support email/password autofill and numeric one-time-code input.
- Make loading, saved, empty, validation, quota-exhausted and network-error states explicit. Preserve typed input after a failed submission and prevent accidental duplicate sends.
- Keep separate form feedback and drafts when switching dashboard sections. Remember the selected Poster section in its URL. Refreshing a conversation must preserve other unsent replies; log out clears drafts in the current tab.
- Keep question/request bodies wrapped, lists paginated and reply previews bounded. Avoid downloading private help data into the common-board client.
- Verify at 320/360/390px, tablet and desktop widths, including keyboard navigation and automated WCAG A/AA checks.

### Implementation and migration

The contract is implemented: Poster-only signup, separate notice/private-help storage and APIs, independent transactional daily quotas, appointed-Helper queues, Admin assignment/revocation/audit, and mobile-first member surfaces.

Migration `20261004120000_notice_private_help` preserves every existing post/reply as notice-board content, backfills verification for accounts created by the previous OTP flow, and resets self-declared Helpers to Poster. Legacy accounts without known verification remain unverified. Run a backup and restore/migration rehearsal before applying this migration to an existing database. Builds never migrate databases.

Regression checks exercise role/college isolation, concurrent publication and invitation replay, failed-write rollback, quota persistence/deletion/IST rollover, stale-session revocation, migration preservation and both database adapters. The isolated production-server browser flow covers both forms, reload/navigation/failed-save draft recovery, independent form feedback, reply-draft retention, topic filters, private Helper responses, Admin activation/appointments/audit and keyboard confirmations, reload/logout, 44px touch targets and automated WCAG A/AA checks at 320/360/390/768/1440px.

## Local development

Use **Node.js 24** and npm. Install dependencies in the OS that runs the app; do not share a Windows-installed `node_modules` with WSL.

```bash
npm ci
cp .env.example .env
# Edit .env locally; never commit credentials.
npm run db:generate
npm run db:migrate
npm run dev
```

`db:migrate` is for the local SQLite URL, not a Turso URL. Use a freshly generated, random JWT secret of at least 32 characters and your own Brevo account with a verified sender. To exercise signup locally, set `REGISTRATION_OPEN=true`. Without working email, the app must not pretend that a code was sent.

`npm test` mocks email and uses disposable databases. `test_prisma.ts --check` is an optional read-only connectivity probe against the configured database; it does not insert test users or codes.

## Verification

```bash
npm run lint
npm run typecheck
npm run typecheck:backend
npm test
npm run build
npm audit --audit-level=high
```

`npm run check` runs lint, typecheck, backend tests and a production build. Backend tests cover signup/OTP/login, notice/private-help activity, Admin invitations/appointments/audit, quotas and concurrency, role/college isolation, throttling, input boundaries, launch gates, feed/reply pagination and SQLite/libSQL migration behavior. No real email is sent and no deployed database is used.

### Latest local verification — 2026-10-04

- `npm run lint`, `npm run typecheck`, `npm run typecheck:backend` and `npm run build` pass.
- `npm test` passes **60 tests**, including personal notice-history pagination, malformed/non-JSON API responses, verification-challenge preservation during a session-configuration outage, role/college isolation and daily-quota races.
- The disposable production-server browser run verifies student, Helper and Admin flows at **320, 360, 390, 768 and 1440px**, with no horizontal overflow, no browser runtime errors and no automated WCAG A/AA violations in the audited screens.
- `npm audit --omit=dev --audit-level=high` passes with **zero production dependency findings**. The full development audit still reports the five upstream lint-tool findings documented under Dependency security.

## Backend authentication

Authentication is server-owned and uses the following flow:

1. A user enters a supported 12-digit college email address.
2. The register route creates a short-lived, hashed verification challenge and sends the one-time code through Brevo.
3. The verify route validates the challenge, hashes the password with bcrypt, creates only a `POSTER` account and issues an HTTP-only, signed JWT session cookie. Forged Helper/Admin signup roles are rejected.
4. Login checks verified membership and password, then issues the session cookie. Destinations are `/poster`, `/helper` or `/superadmin`, based on current database permissions. Invited external-email Admins use the same login page. Logout expires the cookie.

The route guard in `src/proxy.ts` is only an optimistic redirect. Every private API re-reads the user from the database through `requireUser`, validates the college membership, and applies role checks where needed. The session contains only the user ID and role; email addresses and passwords are never sent to the client board.

The dashboard data must be persisted and role/college scoped. Client-supplied author IDs, college IDs and role flags cannot override server-derived membership or permissions. Public profile payloads must exclude email addresses and password hashes. Admin user-management payloads may include a registered email only when needed for authorized member lookup; they must never include passwords, OTP digests or session secrets.

### API contract

All API responses use `Cache-Control: no-store`. Mutations require a same-origin JSON request (logout only requires same origin). Errors return `{ "error": "..." }`, with an appropriate HTTP status; throttled responses also include `Retry-After`. `/api/posts` and `/api/posts/:id/replies` remain notice-only compatibility aliases, with the same permissions/quotas as `/api/notice-board`.

Notice lists use 30-row cursor pages; help/member lists use 20-row pages. Reply previews include the newest 10 replies; history uses 20-row pages with scoped `before` cursors. Notice/help search accepts `q`; notices additionally accept `category` and `scope=college|mine` (default `college`). `mine` derives the author from the authenticated account, with personal-history-scoped cursors. Helper queues accept `view=unanswered|answered|all`, with `answered` showing that Helper's contributions.

| Route | Authorization and purpose |
| --- | --- |
| `POST /api/auth/register` | Send/resend college-email OTP; no role selection |
| `POST /api/auth/verify` | Verify email and create `POSTER` only |
| `POST /api/auth/login` | Sign in and return the fresh role's dashboard destination |
| `POST /api/auth/logout` | Expire the session cookie |
| `GET /api/me` | Safe authenticated profile |
| `GET /api/me/quotas` | Remaining notice/help allowances and IST reset time |
| `GET /api/dashboard` | Notice/personal-help activity for Posters; private help activity for appointed Helpers |
| `GET /api/notice-board` | Own-college notices; any authenticated member |
| `POST /api/notice-board` | Poster only; atomic 1/day notice quota |
| `GET /api/notice-board/:id/replies` | Paginated replies to a visible notice |
| `POST /api/notice-board/:id/replies` | Any authenticated member of that college |
| `GET /api/help-requests` | Poster's own requests or appointed Helper's own-college help queue |
| `POST /api/help-requests` | Poster only; atomic 1/day help quota |
| `GET /api/help-requests/:id` | Requesting Poster or appointed Helper of that college |
| `GET /api/help-requests/:id/replies` | Same private readers as the request |
| `POST /api/help-requests/:id/replies` | Appointed Helper of that college only |
| `GET /api/admin/users` | Admin only; verified own-college members eligible for role management |
| `PATCH /api/admin/users/:id/helper` | Admin only; assign/revoke Helper and persist audit record atomically |
| `GET /api/admin/audit` | Admin only; latest 20 own-college role changes |
| `POST /api/admin/invitations/accept` | Consume an operator-issued email invitation and activate its named Admin account |

Never return private help requests or replies through a notice-board/feed endpoint. A Poster attempting another Poster's private request should receive a non-disclosing not-found response. Recheck the Helper appointment on every private read/write, including after role revocation and with an older JWT.

A verified college email proves access to a supported mailbox. An Admin appointment is permission to help, not a university endorsement or proof of expertise. Study year remains self-declared.

### First Admin

The authorized operator runs this against the intended migrated database, using private `.env` credentials and the final `NEXT_PUBLIC_SITE_URL`:

```bash
npx tsx scripts/provision-admin.ts bachaoo.campusconnect@gmail.com --apply
```

An existing verified member is promoted atomically with an audit entry and unchanged password. Otherwise, Brevo receives a one-time activation invitation: a random token is stored only as a SHA-256 digest, expires after 24 hours, and must be delivered before activation. The token stays in the link fragment, out of request URLs/referrers. The recipient chooses their own password at `/admin/setup`, then signs in using the invited email on `/login`. The CLI never prints an invitation token or password. Reissuing an invitation invalidates the earlier link; activation cannot be replayed.

### Required acceptance checks

- Signup cannot create `HELPER` or `ADMIN`, including direct API calls with forged role fields.
- Only an Admin can appoint/revoke Helpers, and the audit trail persists across reloads.
- All own-college members can read/reply to notices; anonymous and cross-college requests fail.
- Help never appears in the shared feed, search results, previews or common-board payloads.
- A Poster sees only their own help threads; an appointed Helper can see/reply to own-college help. Another Poster and a revoked Helper cannot access the thread even with its ID or a previously valid session.
- Each form accepts one successful submission per IST day. Notice and help allowances are independent, concurrent duplicate requests cannot overspend, and failed saves do not consume quota.
- Quotas survive logout, browser changes and reload; deleting a post does not restore the day's allowance; reset occurs correctly at midnight IST.
- Both dashboard workflows work on a phone, survive a reload, display accurate errors and retain their saved content after logout/login.

## Browser verification

Optional browser tools stay outside the application dependency graph:

```bash
npm install --prefix /tmp/bachaoo-browser-tools playwright @axe-core/playwright
/tmp/bachaoo-browser-tools/node_modules/.bin/playwright install chromium
npm run build
npm run test:browser:local
```

The browser runner starts a loopback-only production server on port 3210, seeds a **temporary** database, checks notice/help publication, private responses, pagination, login/reload/logout, Admin invitation activation/assignment/revocation/audit, stale sessions and responsive/accessibility behavior, verifies persisted rows and cleans up. A second loopback fixture on port 3211 audits the open signup/OTP interface, code recovery, failed verification and resend cooldown with intercepted auth requests. Both fixture servers block external service fetches. `TEST_PORT` changes the first port; the auth fixture uses the next port. `BROWSER_TOOLS_DIR` changes the optional tools location. It never uses real service credentials. `AUTH_LOCAL_TESTING=1` is used only by this loopback fixture: **never enable it on a public deployment**. Production auth currently supports Vercel's trusted ingress; other hosts require a reviewed ingress adapter, not arbitrary client `X-Forwarded-For` headers.

On Linux/WSL, Chromium also needs its OS libraries. If the browser cannot start because a shared library is missing, install the Playwright dependencies using `/tmp/bachaoo-browser-tools/node_modules/.bin/playwright install --with-deps chromium` (system package installation may require administrator access). Browser tools and their dependencies are not application dependencies.

To smoke-test an already running closed preview, use `TEST_BASE_URL=https://your-preview-host TEST_PILOT=1 npm run test:browser`. Do not set `TEST_MEMBER_FLOW=1` against a real deployment; the member flow expects only the runner's disposable fixture database.

## Vercel deployment

`vercel.json` uses `npm ci`, `npm run build`, and the Mumbai region. `.vercelignore` excludes credentials, local databases, tests, scratch scripts and agent notes from CLI uploads. Keep real credentials out of Git. Include the application, migrations, scripts and configuration when committing; a local working tree is not automatically part of a Git-based deployment.

A **closed preview can be deployed without service secrets**. Explicitly pause registration for that deployment even when the project already has configured services:

```bash
vercel deploy --yes --target=preview --env REGISTRATION_OPEN=false --build-env REGISTRATION_OPEN=false
```

The landing page remains available, while signup and its APIs reject registrations. This is not a functioning public campus pilot. Explicitly select `--target=preview` to avoid Vercel choosing production for an initial deployment. Verify the reported target/aliases before sharing the link. Deployment never migrates a database.

### Required settings before opening onboarding

Configure these in the Vercel project's intended environment (Preview and Production are separate). Never paste secrets into source files, chat, screenshots or command arguments.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` or `TURSO_DATABASE_URL` | Persistent `libsql://...` database URL, never `file:` on Vercel |
| `TURSO_AUTH_TOKEN` | Token for that database |
| `JWT_SECRET` | Random secret, at least 32 characters; changing it invalidates sessions and outstanding verification digests |
| `BREVO_API_KEY` | Transactional email API key |
| `BREVO_SENDER_EMAIL` | Sender verified in that Brevo account |
| `SUPPORT_EMAIL` | A **real, monitored** address for reports, privacy requests and account-access issues; published on the site |
| `NEXT_PUBLIC_SITE_URL` | Final HTTPS origin, no path/query; otherwise Vercel's production hostname is used |
| `REGISTRATION_OPEN` | Keep `false` until all launch steps below pass; only literal `true` enables production signup |

Login remains usable for existing members when registrations are paused or email is unavailable. Signup and verification are gated server-side, not just hidden in the UI. Support and auth pages read readiness at request time; changing Vercel environment settings still requires a new deployment to take effect. Public metadata uses the origin present at build time.

### Initial Turso setup

The runtime uses Prisma's libSQL adapter for hosted storage. Create an isolated **preview** database using the **libSQL engine** in [Turso's dashboard](https://app.turso.tech), copy its `libsql://...` URL and generate a database token. If using Turso's CLI, `turso db create bachaoo-preview` creates libSQL storage; do not use its separate `--tursodb` engine for this adapter. Configure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` privately in `.env` for the migration runner and in Vercel's **Preview** environment for the deployed app. `TURSO_DATABASE_URL` takes precedence over the local SQLite `DATABASE_URL`.

Apply the checked-in migrations with `npm run db:migrate:turso`, then verify preview signup, role redirects, both dashboards, posting/replying and logout. Set Vercel Preview's `JWT_SECRET`, Brevo variables, `SUPPORT_EMAIL`, and public origin as listed above. For a working isolated preview signup test, set `REGISTRATION_OPEN=true` only after that preview configuration and migrations are ready.

Create a separate production database and set its own URL/token in Vercel's **Production** environment. Apply migrations to that database using its privately configured local credentials before opening production registration. Builds never migrate databases. Never run the disposable test suite against either hosted database.

The planned public support address is `bachaoo.campusconnect@gmail.com`; configure it as `SUPPORT_EMAIL` in the intended environment and keep it monitored.

### Service configuration tools

Keep actual service credentials in the ignored `.env`; `.env.example` is a blank template. The read-only `scripts/service-preflight.ts` checks Turso connectivity/schema history and the Brevo sender without sending mail or printing credentials:

```bash
DOTENV_CONFIG_OVERRIDE=true npx tsx scripts/service-preflight.ts
```

The override is useful when the shell already exports a local `DATABASE_URL`; otherwise dotenv preserves that shell value over `.env`.

`scripts/configure-vercel.ts` sends secret values through the Vercel CLI's stdin and marks them sensitive. It uses an explicit empty preview branch to target all preview branches and verifies that the CLI actually saved each setting. Configure onboarding closed first:

```bash
npx tsx scripts/configure-vercel.ts preview
npx tsx scripts/configure-vercel.ts production
```

Add `--open` only for the environment being deliberately activated after service checks. For example, use it for an isolated preview signup test before opening production. Redeploy after configuration changes; when deliberately opening signup, use a deployment command without the registration-false overrides from the closed-preview example. `--database-only` configures storage/session/public settings without email credentials and always keeps registration closed.

Brevo may reject a valid API key with HTTP 401 when **Security → Authorized IPs** blocks the server's outbound address. Configure these restrictions to permit the deployment's API traffic; Vercel's outbound addresses can change. Email failures log only a status and safe reason such as `IP_ACCESS_DENIED`, never the recipient, code, API key or raw provider body. A provider rejection is not a sent verification code.

### Launch sequence

1. Confirm the owning account, database and environment. Do not reuse the production database for destructive testing. Create a backup/restore plan before modifying an existing database.
2. Provision Turso under the chosen account and configure its URL/token privately. For an existing database, confirm a backup and review migration history first. Prisma's SQLite migration CLI does **not** speak remote libSQL; use the checked-in runner:
   ```bash
   npm run db:migrate:turso
   ```
   This applies the SQL in `prisma/migrations` transactionally, records checksums and refuses changed/failed history. It never resets the database. A build intentionally does not run migrations.
3. Configure Brevo and verify a real supported college mailbox receives a code. Do not claim delivery from a mocked test. For the new product contract, verify Poster-only signup, Admin Helper appointment/revocation, notice visibility, private-help isolation, both daily quotas, replies, reload and logout on a preview backed by an isolated preview database.
4. Assign an accountable operator and monitor `SUPPORT_EMAIL`. Follow the pilot operations checklist below before publishing that address.
5. Set the final HTTPS origin and intended environment values. Run `npm run check:deployment` against the intended configuration. This prints **only readiness flags**, not secret values. It checks configuration, not connectivity or email delivery.
6. Once migrations, real verification and support are proven, set `REGISTRATION_OPEN=true`, rebuild/redeploy and rerun the end-to-end smoke checks. Deploy with `vercel --prod` only when deliberately opening the production target.
7. Monitor failed authentication, database errors, mail-provider quotas and latency. Pause signup by setting `REGISTRATION_OPEN=false` and redeploying if the pilot needs to stop collecting new accounts. Existing users can still sign in.

For an upgrade, pause onboarding on the existing release first, then create a private consistent snapshot and rehearse the pending migrations on its separate local copy:

```bash
npx tsx scripts/backup-turso.ts --output /absolute/private/path/bachaoo-before-upgrade.db --rehearse
```

The parent directory must already exist. This tool reads the remote database only, refuses to overwrite files, uses owner-only permissions, verifies integrity/foreign keys and compares preserved account/content fields after restoring and migrating the rehearsal copy. Keep both files outside the checkout and deployment upload. Once the rehearsal passes, apply the checked-in migration to the intended remote database, deploy the verified application, check services/access gates, then reopen onboarding deliberately.

### Pilot operations checklist

A contact setting is not proof that someone monitors it. Before opening registration:

- Name the responsible operator and backup contact; define realistic response times and regularly check the inbox.
- Handle reports of harassment, spam or exposed personal data. Locate the specific post/reply, preserve only necessary restricted evidence, and remove offending content through authorized database tooling. There is no in-app moderation queue yet.
- Verify privacy/account ownership through the registered college email; never ask for passwords or verification codes. Deliver requested data securely, not in logs or public issues. For a confirmed account-removal request, handle dependent replies/posts before deleting the user (the database has foreign keys), including other people's replies to that user's posts. Review the scope with the requester and retain only what the documented policy requires.
- Account recovery is operator-assisted; there is no self-service password-reset flow. Verify identity first and use an approved recovery procedure. Do not manually share or reset passwords in email. If necessary, agree on deletion/re-registration, explaining content loss before acting.
- Test backups and restoration; restrict database access, audit operator actions without logging private payloads, and define retention periods for backups and request records.

Do not advertise a broad public launch until these operational responsibilities and real-service checks are fulfilled.

## Dependency security

Prisma 7.10.0 pins vulnerable transitive `deepmerge-ts` and `mysql2` versions. Narrow overrides select `deepmerge-ts@8.0.2` under `@prisma/config` and `mysql2@3.24.5` under `prisma`, without downgrading Prisma or changing the database stack. Validate these with Prisma schema validation/generation, the migration tests and production builds. Remove the overrides when an upstream Prisma release carries compatible patched versions. Do not run `npm audit fix --force`: its suggested Prisma downgrade is a breaking change.

As of 2026-10-04, the full development dependency audit reports five high-severity findings along `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). The advisory has no patched release; npm's proposed fix downgrades `eslint-config-next` to Next.js 14 and is incompatible with this app. Track the upstream fix and keep lint glob patterns developer-controlled. `npm audit --omit=dev --audit-level=high` currently passes with zero findings; the full `npm audit --audit-level=high` remains an explicitly tracked failing check until a compatible patched dependency is available.
