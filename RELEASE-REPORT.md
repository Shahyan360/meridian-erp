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
- Firefox cannot launch on this Windows host (`spawn UNKNOWN`). The Linux GitHub Actions workflow runs Chromium and Firefox before hosted release verification.

## Real external integrations

- Real Gemini responses were tested against an isolated copy of demo data. The original model identifier was unavailable for this key; the working configurable default is `gemini-3.1-flash-lite`. Minimal thinking avoids unnecessary latency.
- AI answer review found a currency-label issue; the server now supplies workspace currency/date and sales results include the currency explicitly. A regression check verifies currency in actual responses.
- Live AI cases cover help, today's exact sales/count/currency, actual low-stock names, HR navigation, product proposal/confirmation/replay prevention, employee escalation denial, invoice proposal/confirmation, PDF export, public private-data denial, and contact confirmation. Final execution results are recorded below after completion.
- Gmail SMTP accepted and sent the requested owner verification message. Contact storage precedes email delivery; delivery failures remain visible and retryable in Admin Inbox. SMTP credentials are private server variables.
- A Neon Free database was provisioned through the authenticated Vercel project. It stores production data persistently; no public demo credentials are created in production. A private owner password is saved only in the ignored production environment file.

## Hosted release

Pending final GitHub workflow and deployment smoke checks. No secrets, local databases, real contact messages, sessions, or generated clients belong in the public repository.

## Practical limits

- Vercel Hobby is intended for personal/non-commercial projects; provider quotas apply. Gemini availability and SMTP delivery depend on provider credentials, quotas and network conditions.
- No paid plan was selected. A custom domain is optional and must be owned/configured by the user.
- Docker/Caddy configuration is supplied for a Linux VPS, but no Docker daemon or actual VPS is available here to validate that deployment path. MySQL remains supported but no live MySQL service was available; SQLite and native PostgreSQL were exercised.
- No payment gateway, statutory filing, disaster recovery service or automatic backup subscription is configured. Arrange production backups and monitor provider quotas before business use.
- Automated accessibility checks and browser scenarios are bounded. Manual assistive-technology testing, Safari, real mobile devices, prolonged load tests and provider outage drills were not performed.
