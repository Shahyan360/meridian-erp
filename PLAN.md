# Meridian ERP — delivery plan

## Phase 0 — audit (25 October 2026)

The existing project is a React 19/Vite 8 single-page application, an Express 4 API, and Prisma 6 with a MySQL schema. It includes products, inventory, sales, purchases, customers/vendors, employees/payroll/leaves, expenses, school admissions/classes/guardians/attendance/fees, and a double-entry accounting foundation. There is no authentication or user model, no chatbot, public site, settings, inbox, or critical-flow tests. No running MySQL service is available locally. Root/client/server dependency installs and scripts are inconsistent.

Observed gaps: unrestricted APIs and mass assignment; plaintext server exception disclosure; duplicate route registrations; draft/cancelled transactions affect stock and cash; race-prone document numbering; no payment allocation for commercial documents; no cost-of-sales posting; incomplete server validation; dashboard silently replaces errors with zeros; nonfunctional search/navigation/notification controls; static demo totals and dates; inaccessible modals; no pagination, loading states, durable demo seed, or production serving. The existing UI is mostly a generic school module launcher with dead dashboard code and duplicate styles.

## Decisions

- Retain React, Vite, Express, Prisma, PDFKit, the existing MySQL schema and school domains. Consolidate duplicate/insecure CRUD and transaction handlers into shared validated services; retain domain behavior where useful.
- Add a generated SQLite Prisma schema/client for explicit demo mode. Default to demo mode so a fresh install works without external services. MySQL remains available using DATABASE_MODE=mysql and DATABASE_URL. Never inspect or print existing secret values; preserve the existing .env.
- Use persistent, revocable, hashed sessions in HttpOnly SameSite cookies, scrypt password hashes, server-enforced Admin/Manager/Employee access, same-origin mutation checks, and rate limits. Employee access excludes HR compensation, financial reports, settings, inbox, and writes.
- Use integer minor-unit calculations for transaction totals, explicit draft/post/cancel states, atomic stock movement and balanced journal posting, and separate allocated payments. Posted document edits/deletes are restricted to protect the audit trail; cancel unpaid documents to reverse their effects.
- Create original Meridian visual branding, a blue/slate design system, responsive shell, accessible forms/dialogs, real data charts, and a lazy Three.js public hero with reduced-motion/WebGL fallback.
- Gemini runs only on the server. Tool proposals are persisted and bound to the current session or public chat, expire, and require a separate explicit confirmation request for every write. Read/query/navigation/export tools are allowlisted. Treat model output and ERP text as untrusted.
- No Git operations, commits, or remote assumptions.

## Ordered execution

1. [x] Audit source, stack, schemas, and runtime availability; write this plan.
2. [x] Consolidate installation/scripts; extend schema; generate demo database and idempotent seed.
3. [x] Implement authentication, roles, validation, CRUD, stock/order/payment accounting, reports/export, settings/users, and preserve school modules.
4. [x] Verify core API with integration tests, run server, and build client (Phase 1 gate).
5. [x] Build responsive design system, dashboard, command palette, charts, motion, themes, and premium CRUD experience (Phase 2 gate: run/build).
6. [x] Add landing/about/contact/pricing, lazy 3D hero, admin inbox, SEO/error pages (Phase 3 gate: run/build).
7. [x] Add streaming Gemini chat, safe tool loop, confirmation UX, persistent chat history, help/contact modes, and mocked tests (Phase 4 gate: run/build).
8. [x] Finish README, accessibility checks, lint/format, critical browser/API tests, clean install/build/start verification; record exact results and remaining manual configuration.

## Verification log

Phase 1: `npm run setup`, `npm test` (10 integration tests), and `npm run build` passed. Started the application with `npm start`. Demo SQLite uses an absolute file URL to avoid Windows relative-path creation failures. Existing .env remains untouched. Shared domain metadata now powers strict server validation and the forthcoming UI. The school domains remain supported through the same shared services. Posted orders, receipts, payroll and expenses are protected from destructive edits. Unpaid commercial orders have explicit, auditable cancellation/reversal. Tax, discount, cost of sales, receivables/payables and partial payments are posted through balanced journals.

Phases 2–3: running production server + browser smoke check passed (desktop dashboard, authenticated routing, no page errors or horizontal overflow). Production build and all 10 API tests pass. Added original responsive visual system, self-hosted OFL fonts, local theme preference, accessible dialogs, animated real-data KPIs/charts, notifications, command palette, and working record forms. Public landing/story/contact/pricing preview pages are complete. Testimonials, creator identity/photo/bio, and preview pricing are explicitly marked placeholders. Three.js is a separate lazy chunk with an original CSS fallback, reduced-motion handling, offscreen render suspension, and resource disposal. Remaining browser accessibility/mobile checks are in the final gate.

Phase 4: production build and 19 API tests pass, including 9 Gemini-specific mocked tests. The model key is sent only in a server request header. The SSE tool loop preserves thought signatures and function-call IDs. Data reads, navigation, report exports, product create/update/delete proposals, draft invoice proposals, help, and public contact mode are implemented. Every write requires a separate, session-bound, expiring, single-use confirmation. Tests cover rejection, replay, cross-session access, invalid tool arguments, unauthorized/injected tool calls, missing key, and sanitized upstream errors. No real Gemini account or live API call is needed by tests. Contact-owner mode works without Gemini.

Final review improvements: weighted-average inventory costing, posting-time cost snapshots, discount allocation, explicit rounding entries, and reversal restrictions after subsequent stock movements protect inventory/accounting consistency. Unpaid fee edits now append reversing journals instead of deleting financial history. Replaced dead module wrappers and duplicate CSS/API implementations with shared metadata and services. Automated accessibility review identified and fixed low-contrast text, increased small interface type, and corrected interactive chart semantics; final checks follow below.

## Final verification — completed 25 October 2026

- `npm ci`: clean root/workspace dependency installation succeeded. `npm audit`: **0 vulnerabilities**, including development dependencies. Existing Prisma 6 is retained with patched transitive dependencies; Zod was updated to the patched release.
- `npm run setup`: succeeded against both the existing demo and a **brand-new independent database**. The fresh database contains 3 users, 12 products, and 48 sales; trial balance is balanced. No existing database or .env was replaced.
- `npm run dev`: verified Vite on 5173 and Express on 4000, including correct root environment/database paths when npm runs the server from its workspace directory.
- `npm run check`: **lint 0 errors/warnings, formatting passed, 23 API tests passed, production build passed** with separate lazy route/chat/Three.js bundles and no chunk-size warnings.
- `npm run test:e2e`: **11 browser tests passed**. Coverage includes public pages/404, notifications, themes and persistence, command search, product CRUD/CSV, multi-line sales/post/payment/PDF, contact-to-Inbox/read status, missing-key assistant/contact confirmation, employee access, 390px mobile layout, HR/payroll/manual journals, and WCAG A/AA scans in light/dark themes and record dialogs. No automated accessibility violations remain on scanned pages. Keyboard dialog Escape/focus behavior is covered.
- Production application started with `npm start` at **http://localhost:4000**. Source contains no TODOs, debug console calls, obsolete template branding/assets, or hardcoded provider credentials. No Git operations were performed.

## Manual configuration and practical boundaries

- Demo needs **no environment variables**. Use the documented demo accounts, or one-click role buttons on the sign-in page.
- Optional live AI: supply server-only `Gemini_API_KEY` (fallback `GEMINI_API_KEY`) and optionally `GEMINI_MODEL`, then restart. Live provider calls were not exercised; the complete tool/streaming integration is mocked in tests.
- MySQL production path is retained and documented, but was not runtime-tested because no MySQL service is available here. Provision MySQL/HTTPS/origin/administrator credentials and review schema changes against a backup before using an existing production database. No hosting, external email, payment processor, or paid billing checkout was provisioned.
- Replace the explicitly marked creator name/photo/bio and testimonial placeholders, review preview pricing, and update business settings before public launch.
- Financial protections are intentional: posted documents/receipts cannot be destructively edited, and cancellation is blocked after payments or later stock movements. Exports are filtered and capped at 10,000 records. Currency changes relabel amounts rather than convert them. These behaviors are explained in README.md.
