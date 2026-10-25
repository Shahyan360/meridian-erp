# Meridian release verification

Verified 25 October 2026. Tests provide evidence for the scenarios below; they cannot establish that every possible input, device, or failure condition is covered.

## Local release checks

- Clean `npm ci`: passed, 433 packages audited, zero reported vulnerabilities. The first Windows attempt encountered a temporary directory lock; the retry completed successfully.
- `npm run setup`, lint, formatting, production build: passed on Node 24.18.0 / npm 11.
- API tests: **35 passed**. Authentication/session revocation; Admin/Manager/Employee access across every module; origin/CSRF validation; CRUD/search/sort/pagination; linked-record deletion guards; stock valuation; atomic posting/reversal; partial payments and overpayment prevention; journal balance/immutability; payroll; attendance/leave/fees; settings/users; CSV/PDF; contact honeypot/rate limits; email outage/retry/idempotency; chatbot validation, injection/role safeguards, confirmation expiry/replay, history and sanitized upstream errors.
- Native PostgreSQL: **2 integration tests passed**, including initialization, private owner login, long contact text, case-insensitive search, product/inventory/sale/payment/report flow, and shared database rate limits.
- Chromium: **13 end-to-end tests passed**, including 28 workspace routes/tabs, keyboard command navigation, product CRUD/export, invoice posting/payment/PDF, HR/payroll/manual journal, public/contact/Inbox, missing-key assistant/contact confirmation, roles, themes, and mobile navigation.
- Public layout checks passed at 320, 375, 768 and 1024 pixels. A rotated hero fallback previously caused 320px overflow; clipping the decorative scene fixed it.
- Automated axe WCAG 2 A/AA and 2.1 AA checks passed for the dashboard in both themes, product dialog, contact in both themes, and revealed landing content. This is not a manual screen-reader certification.
- **Linux CI passed all 26 Chromium/Firefox scenarios**, clean install, 35 API tests, 2 PostgreSQL tests, formatting/lint and build: [release run](https://github.com/Shahyan360/meridian-erp/actions/runs/40169206227), code commit `d0af554`. Documentation was finalized afterward without changing application code.
- Firefox cannot launch on this Windows host (`spawn UNKNOWN`), so cross-browser verification runs on Linux GitHub Actions. Early runs exposed shared test state/rate-limit exhaustion; each browser/suite now gets a fresh database/server without weakening production limits. Firefox then exposed a real race between loading chat history and sending a message. The widget now waits for history before accepting input, with a regression test that deliberately holds the history response.

## Real external integrations

- Real Gemini responses were tested against an isolated copy of demo data. The original model identifier was unavailable for this key; the working configurable default is `gemini-3.1-flash-lite`. Minimal thinking avoids unnecessary latency.
- AI answer review found a currency-label issue; the server now supplies workspace currency/date and sales results include the currency explicitly. A regression check verifies currency in actual responses.
- **10 live AI cases passed**: help, today's exact sales/count/currency, actual low-stock names, HR navigation, product proposal/confirmation/replay prevention, employee escalation denial, invoice proposal/confirmation, PDF export, public private-data denial, and contact confirmation. Gemini intermittently returned rate limits/timeouts during testing; paced requests and bounded retries completed the checks. The UI handles these provider failures with friendly errors.
- Manual review also found the help response confused normal payment submission with assistant confirmation cards. An authoritative UI guide and a targeted live regression check now verify the actual Save draft → Post order → Pay → Record payment sequence.
- Gmail SMTP accepted and sent the requested owner verification message. Contact storage precedes email delivery; delivery failures remain visible and retryable in Admin Inbox. SMTP credentials are private server variables.
- A Neon Free database was provisioned through the authenticated Vercel project. It stores production data persistently; no public demo credentials are created in production. A private owner password is saved only in the ignored production environment file.

## Hosted release

- Public source: [Shahyan360/meridian-erp](https://github.com/Shahyan360/meridian-erp). Source and browser assets were scanned against the actual private credentials before publication; environment files, database files, generated clients, and verification artifacts are excluded.
- Candidate deployment: **9 hosted checks passed** for public assets/direct routes, database health, private admin login and secure cookies, every module/dashboard/report API, forged-origin/input rejection, PostgreSQL product CRUD/search, PDF/CSV, public Contact → private Inbox → real Gmail delivery, browser navigation/mobile/axe checks, and a streamed real Gemini answer.
- A hosted sign-in check caught a missing allowed production origin; configuring the exact application origin fixed it. Functions are deployed in Singapore, near the database. The 3D hero rendered a real WebGL canvas with mouse interaction and no browser page errors.
- **Public website:** [Meridian ERP](https://meridian-erp-khalidshahyan0-1999s-projects.vercel.app). The final **8 public smoke groups passed without a Vercel login/bypass token**, including owner session, every module API, CRUD, exports, browser/axe/mobile navigation, and real streamed Gemini. The separate hosted contact test verified actual Inbox persistence and Gmail delivery. A dashboard wait timed out in one intermediate run; subsequent candidate and public runs passed without an application change. Provider/network latency remains a practical consideration on free hosting.
- GitHub's About website link points to the public application. Production data persists in Neon across function invocations/deployments. Current production uses secure HTTP-only sessions and has no public demo users. Vercel authentication remains enabled for preview/deployment URLs, while the promoted production domain is public; ERP data still requires its own login.
- Owner sign-in details are stored in the ignored local `artifacts/OWNER-ACCESS.txt`, never in this repository. The user should sign in, change the initial owner password in Settings → Users, and set actual workspace details. Future source updates can be deployed with the authenticated Vercel CLI (`vercel --prod`); automatic GitHub deployment linkage is not configured.

## Practical limits

- Vercel Hobby is intended for personal/non-commercial projects; provider quotas apply. Gemini availability and SMTP delivery depend on provider credentials, quotas and network conditions.
- No paid plan was selected. A custom domain is optional and must be owned/configured by the user.
- Docker/Caddy configuration is supplied for a Linux VPS, but no Docker daemon or actual VPS is available here to validate that deployment path. MySQL remains supported but no live MySQL service was available; SQLite and native PostgreSQL were exercised.
- No payment gateway, statutory filing, disaster recovery service or automatic backup subscription is configured. Arrange production backups and monitor provider quotas before business use.
- Automated accessibility checks and browser scenarios are bounded. Manual assistive-technology testing, Safari, real mobile devices, prolonged load tests and provider outage drills were not performed.
