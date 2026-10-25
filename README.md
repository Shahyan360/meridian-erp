# Meridian ERP

A connected workspace for sales, purchasing, inventory, relationships, people, accounting, and school administration. Built directly on the original React/Vite, Express, Prisma, and MySQL stack, with a self-contained SQLite demo.

[Open the website](https://meridian-erp-khalidshahyan0-1999s-projects.vercel.app) · [Public source](https://github.com/Shahyan360/meridian-erp) · [Passing release checks](https://github.com/Shahyan360/meridian-erp/actions/runs/40169206227)

The hosted workspace uses persistent PostgreSQL and a private owner account. Demo logins below apply to local demo installations only; production does not expose demo accounts. Gemini and Gmail notifications are configured as private server environment variables.

## Start here

Use Node.js **24** and npm **11** (the versions used for verification). Run every command from this folder:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://localhost:5173**. The API runs on port **4000**. No environment file, MySQL service, or Gemini key is required for the default demo.

For the built application, served by Express:

```sh
npm run build
npm start
```

Open **http://localhost:4000**. Both public pages and authenticated workspace routes support direct loads and refreshes.

`npm run setup` generates the demo Prisma client, creates/updates `prisma/demo.db`, and seeds the workspace. Re-running setup preserves existing records. The existing `.env` is never overwritten. The root lockfile is authoritative for all workspaces.

## Demo logins

All three accounts use **`Demo@Meridian26!`**. The sign-in page also has one-click demo role buttons.

| Role     | Email                    | Access                                                                                                                                |
| -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Admin    | `admin@meridian.demo`    | All modules, Inbox, settings, users, activity log                                                                                     |
| Manager  | `manager@meridian.demo`  | Operations, HR/payroll, finance, exports                                                                                              |
| Employee | `employee@meridian.demo` | Read-only products, inventory, sales/purchases, relationships, school operations; no compensation, finance, Inbox, users, or settings |

Sample data includes six months of sales/purchases, paid and outstanding invoices, products, low-stock items, customers/suppliers, employees, payroll, students, attendance, fees, and an inbox message. These are fictional demo records.

## What’s included

- Public landing page with a lazy Three.js hero, original visual identity, feature/module showcase, pricing preview, story/technology/creator section, validated contact form, and 404 page.
- Responsive workspace, light/dark themes, local fonts, reduced-motion support, keyboard focus states, focus-trapped dialogs, loading/error/empty states, toasts, and page/scroll animations.
- Real-data dashboard: animated KPIs, interactive revenue/purchase chart, inventory categories, top products, recent orders, activity, quick actions, low-stock and inbox notifications, and **Ctrl+K / Cmd+K** search.
- Server-enforced authentication and role access; administrator-managed accounts and password resets; revocable database sessions in HttpOnly cookies; scrypt password hashes.
- Shared validated CRUD with server search, status filters, sorting, pagination, CSV/PDF exports, and linked-record protections.
- Product catalog/categories; inventory adjustments, reorder thresholds, and movement history; customers and suppliers.
- Multi-line sales and purchase orders, server-calculated tax/discount totals, draft/post/cancel lifecycle, allocated partial/full payments, invoice/order PDFs.
- Employee directory, departments, compensation, payroll calculations/payslips, and leave approvals.
- School students/classes/guardians and guardian links, attendance, student leave, fee assignments, payment receipts, and overpayment protection.
- Accounting: balanced double-entry journals, chart of accounts, cash opening deposits, date-filtered profit/loss, balance sheet, trial balance, receivables/payables, CSV/PDF financial reports.
- Workspace settings, team access, activity log, admin Inbox, and honeypot/rate-limited contact capture.
- Floating Gemini assistant with streaming Markdown responses, saved conversation history, suggested prompts, workspace/help/contact modes, permitted read/navigation/export tools, and separately confirmed write proposals.

## Order and accounting workflow

1. Create a customer/supplier and product catalog entries.
2. Products receive a zero-stock inventory record automatically. Adjust opening stock in Inventory, or create a purchase and post it to receive stock.
3. Add an order with product lines. The server calculates totals. Saving a draft has no stock or ledger effect.
4. Review and **Post**. Purchases receive stock and create payables; sales issue stock and create receivables/revenue/cost-of-sales entries.
5. Use **Pay** to allocate an amount. Partial payments reduce the balance; a fully settled order is marked Paid. Overpayments and negative stock are rejected atomically.
6. Unpaid orders can be cancelled from their details. Reversal preserves journal and movement history. Cancellation is blocked after later stock movements; orders with payments are protected.

Posted orders, paid receipts, posted payroll and posted expenses are immutable. Unused drafts support edit/delete. Products with stock/history should be made inactive instead of deleted. Core posting account codes/types cannot be changed or deleted.

Money calculations use rounded integer minor units. Inventory uses weighted-average cost, discount allocation, posting-time cost snapshots, and explicit rounding entries. Date-only forms are normalized to midnight UTC; dashboard “today” uses the workspace timezone. Reports use inclusive UTC date boundaries and include opening/prior balances in the balance sheet, while profit/loss is limited to the selected period. Currency settings change display/labels; they do not convert historical amounts. Exports are limited to 10,000 filtered records per request. Tax rate is a simple configurable document percentage; statutory tax filing and payment-provider integration are outside this application.

## Environment variables

Copy `.env.example` to `.env` only if you need configuration. Keep `.env` private; it is ignored. The example contains placeholders only. Never use `VITE_` for secrets.

| Variable            | Default / purpose                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_MODE`     | `demo`, `mysql`, or `postgres`                                                                       |
| `DEMO_DATABASE_URL` | `file:./demo.db`; relative file paths resolve inside `prisma/`, or use an absolute `file:` URL       |
| `DATABASE_URL`      | Private MySQL/PostgreSQL connection string for persistent hosting                                    |
| `DEMO_MODE`         | Demo seeding/UI enabled with demo database unless set to `false`; MySQL never seeds demo accounts    |
| `ADMIN_EMAIL`       | Initial administrator email for a new non-demo database                                              |
| `ADMIN_PASSWORD`    | Initial administrator password, at least 12 characters, for a new non-demo database                  |
| `PORT`              | `4000`                                                                                               |
| `APP_ORIGIN`        | `http://localhost:5173`; set to the public application origin when deploying                         |
| `NODE_ENV`          | `development`; use `production` behind HTTPS to enable Secure cookies                                |
| `Gemini_API_KEY`    | Preferred server-side Gemini API key; optional                                                       |
| `GEMINI_API_KEY`    | Fallback when `Gemini_API_KEY` is unset                                                              |
| `GEMINI_MODEL`      | `gemini-3.1-flash-lite`; configurable model identifier                                               |
| `BUSINESS_TIMEZONE` | `Asia/Karachi`; initial assistant/business date fallback; workspace settings control dashboard dates |

## MySQL / non-demo setup

Create a MySQL database and set the following values in your private `.env`:

```dotenv
DATABASE_MODE=mysql
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/meridian
DEMO_MODE=false
ADMIN_EMAIL=YOUR_ADMIN_EMAIL
ADMIN_PASSWORD=YOUR_LONG_UNIQUE_PASSWORD
APP_ORIGIN=https://YOUR_APPLICATION_HOST
```

Then run `npm run setup`, `npm run build`, and `npm start`. Setup generates the MySQL client, applies the schema, creates system posting accounts, and initializes an administrator when there are no users. For an existing database, back it up and review the Prisma schema change before applying it; setup does not pass destructive-data-loss flags. The original schema and migration history remain in `prisma/`. Additive fields/models are represented in the current canonical schema; existing historic migrations alone do not describe the full new schema. MySQL was retained but could not be exercised here because no local MySQL service is installed; the complete automated suite runs on isolated SQLite copies.

For production, use HTTPS, private credentials, and your actual `APP_ORIGIN`. Production rate limits are stored in the database and shared across instances. Demo accounts are disabled in production. Back up your database before schema changes. PostgreSQL is also supported using a generated schema; run the same setup commands with `DATABASE_MODE=postgres` and a PostgreSQL `DATABASE_URL`.

## Vercel and free hosting

Vercel is serverless hosting, not a VPS. Use a persistent hosted PostgreSQL database such as Neon; SQLite files cannot persist there. Set the following in Vercel Project Settings, never in browser code:

- `DATABASE_MODE=postgres`, `DATABASE_URL` from your database provider, `DEMO_MODE=false`.
- `ADMIN_EMAIL`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` (12+ characters) for initial setup.
- `APP_ORIGIN=https://YOUR_HOST` (the platform deployment domains are also recognized automatically).
- Optional Gemini and email settings described below.

Initialize the new database once by running `npm run setup` locally with those private production variables loaded. Then deploy using `vercel --prod`; `vercel.json` runs `npm run build:cloud`, generates the PostgreSQL client, and serves the API and static site together. Schema setup is separate from the build and is never triggered by public requests. Use a small connection pool for serverless databases (`connection_limit=2&pool_timeout=20`).

The checked-in GitHub Actions workflow runs clean installation, formatting/lint, API, real PostgreSQL, and Chromium/Firefox checks. Vercel Hobby is intended for personal/non-commercial use and hosting, database, Gmail, and Gemini quotas still apply. No paid plans are required by the code. Review the current [Vercel Hobby terms](https://vercel.com/docs/plans/hobby) before commercial use.

## Small Linux VPS

Docker and Caddy configuration is included. Create a private `.env.production` with `APP_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_MODE=false`, and your server secrets. For a single small VPS, `DATABASE_MODE=demo` uses SQLite on the persistent `/data` volume but never creates demo users when `NODE_ENV=production`. For hosted PostgreSQL/MySQL, set that mode and URL instead. Set `SITE_HOST` to a domain pointing to the VPS, then run:

```sh
docker compose --env-file .env.production up -d --build
```

Caddy provides HTTPS on ports 80/443. The app is limited to 512 MB in Compose; actual capacity depends on traffic and provider limits. Docker is supplied as a deployment option and must be tested on the chosen Linux host. Keep persistent volumes/database backups. Do not run multiple SQLite instances.

## Contact notifications

Messages are saved in the private admin Inbox first. Configure `CONTACT_NOTIFICATION_EMAIL`, `EMAIL_FROM`, and either `RESEND_API_KEY` or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Gmail uses `smtp.gmail.com`, port `465`, and a Gmail app password for the sending account (requires 2-Step Verification). Never use an account password or place secrets in `VITE_` variables. Failed email delivery does not lose the message; the Inbox shows delivery status and offers a retry. `npm run test:email:live` sends one verification message to the configured owner.

## Gemini assistant

Set `Gemini_API_KEY` (or fallback `GEMINI_API_KEY`) in the server environment and restart the API. All requests go through `/api/chat`; the browser never receives the key. The implementation follows the [Gemini streaming and function-calling API](https://ai.google.dev/api/generate-content).

Example prompts:

- “Show today’s sales.”
- “Which items are low on stock?”
- “Add a product called Sketchbook, price 1200, cost 700, stock 20.”
- “Create an invoice for Northstar Creative.” The assistant searches for existing customers/products and asks for missing details.
- “Open the HR page.”
- “Export this month’s report as PDF.”
- “How do partial payments work?”
- “I’d like to contact the owner.”

Read/search/navigation/export tools check the current role on the server. Product create/update/delete, draft invoice creation, and contact messages produce review cards. A **separate Confirm action** request is required to write. Proposals are bound to the current chat and identity, expire after 10 minutes, and cannot be replayed. Role checks run again at confirmation. Model output and record text are untrusted; tool names and inputs are allowlisted/validated. The model cannot run arbitrary SQL, execute code, choose external URLs, or confirm its own actions.

When the key is absent, the application still runs and the assistant explains how to enable live AI. **Contact owner** has a validated form and confirmation flow that work without Gemini. Messages go to Inbox and trigger configured email delivery. Chat history is stored in the database and can be cleared from the widget. Contact and chat endpoints have input limits and rate limits, and upstream errors are sanitized. `npm test` mocks Gemini; `npm run test:ai:live` explicitly calls the configured real provider against an isolated test workspace and may consume provider quota. The live release checks are recorded in RELEASE-REPORT.md. Keys remain on the server, so visitors can use the deployed assistant from any device without supplying their own key.

## Checks

```sh
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:postgres
# Both browsers (install first):
npx playwright install --with-deps chromium firefox
npm run test:e2e:all
```

`npm run check` combines lint, formatting, API tests, and build. `npm run format` applies formatting.

API tests cover auth, cookies/roles/origin checks, validation, CRUD, stock/posting/payment/reversal behavior, reports, exports, contact capture, and mocked Gemini tool safeguards. Browser tests cover public pages, CRUD, invoicing/payments/PDF, themes, command navigation, Inbox, missing-key chat/contact confirmation, role restrictions, mobile layouts, and automated WCAG A/AA checks. Tests copy the demo database into isolated files; they do not edit the live workspace. The browser test server uses port **4100** and explicitly disables live Gemini.

## Project map

```text
client/src/pages/       Public pages, dashboard, records, reports, settings
client/src/components/  Shell, reusable UI, Three.js hero, assistant
client/src/services/    API requests and authenticated downloads
server/src/app.js       Express app factory and routes
server/src/lib/         Security, validation, domain operations, accounting,
                       queries/exports, Gemini transport and tool executor
server/src/chat.js      Streaming chat, history, proposals/confirmation
server/src/seed.js      Idempotent initialization and fictional demo data
shared/catalog.js      Shared module/field metadata
prisma/schema.prisma   Canonical MySQL schema; SQLite/PostgreSQL schemas generated from it
scripts/               Database setup and isolated browser-test server
server/test/, tests/   API and browser/accessibility tests
PLAN.md                Audit, decisions, gates, and verification evidence
```

## Before public launch

The creator section links to Shahyan360; no invented biography, photo, or customer endorsements are published. Confirm your actual pricing; current prices are labeled preview plans and have no checkout. Set real workspace details and create additional users from admin Settings. Production starts with a private owner account and empty operational data. The visual identity, favicon, illustrations, layout, and copy were created for this project; fonts use OFL licenses through Fontsource and library licenses remain with their packages. See RELEASE-REPORT.md for verification evidence and remaining deployment limits.
