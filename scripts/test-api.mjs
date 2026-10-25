import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", "server/test/*.test.js"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_MODE: "demo",
      DEMO_MODE: "true",
      RATE_LIMIT_STORE: "memory",
      VERCEL: "",
      APP_ORIGIN: "http://localhost:5173",
      APP_ORIGINS: "",
      RESEND_API_KEY: "",
      SMTP_PASS: "",
      CONTACT_NOTIFICATION_EMAIL: "",
    },
  },
);
process.exit(result.status ?? 1);
