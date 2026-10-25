# Publication and release verification

Requested 25 October 2026: make server-side Gemini usable from deployed hosts, expand end-to-end/accessibility/AI testing, publish to Shahyan360 on GitHub, and deploy on a free hosting plan if possible.

## Decisions and constraints

- The new GitHub publication request authorizes Git/commits/push for this release, superseding the previous task's no-Git restriction. Preserve the original PLAN.md as historical evidence.
- Confirmed existing GitHub credentials belong to **Shahyan360**. No remote or commits currently exist. Never publish `.env`, local databases, chat/contact/session data, generated clients, or account credentials.
- The user supplied a private Gemini key. Real provider tests run against an isolated database; the key stays in server environment variables and is never published.
- Vercel is serverless hosting, not a VPS. Its filesystem cannot persist SQLite writes. Add an optional generated PostgreSQL schema/client for a hosted persistent database while preserving MySQL and the local SQLite demo.
- Add a Vercel function entry point, static SPA routing, production origin/proxy handling, durable rate limiting, and explicit initialization/build commands. Also provide a small VPS deployment path with persistent storage.
- Vercel Hobby is for personal/non-commercial projects and all free services have quotas. No paid plan was selected. The user authenticated Vercel and accepted Neon terms; a Neon Free database is connected to the project.
- Contact messages remain private in Admin Inbox. The user requested email as well, supplied Gmail credentials privately, and real SMTP verification succeeded. Failed notifications remain retryable.

## Worklist

1. [x] Inspect deployment gaps, account access, and current hosting documentation.
2. [x] Add portable database/runtime/deployment configuration and secure cloud key handling.
3. [x] Extend test coverage across all modules, edge cases, roles, navigation, accessibility, streaming/provider errors, and deployment-specific behavior.
4. [x] Run clean-install/build/API/browser/database validation; record exact tested and untested cases in RELEASE-REPORT.md. No claim of exhaustive coverage of all possible scenarios.
5. [x] Run live AI response checks when a valid key is available. Report errors/quotas honestly.
6. [x] Publish reviewed source to Shahyan360 GitHub; configure repository documentation and About website URL after deployment.
7. [x] Deploy and run public-URL smoke tests when hosting/database access is available. Record remaining user actions precisely if external access blocks release.

## Release outcome

Public source is https://github.com/Shahyan360/meridian-erp. The website is https://meridian-erp-khalidshahyan0-1999s-projects.vercel.app. Free Neon and Vercel hosting are configured. The verified code release passed Linux CI (35 API + 2 PostgreSQL + 26 Chromium/Firefox scenarios), 10 live AI scenarios, hosted contact/Gmail delivery, and 8 final public smoke groups. Keys and private owner credentials remain excluded from source and browser bundles. See RELEASE-REPORT.md for limits and the private local owner-access handoff.
