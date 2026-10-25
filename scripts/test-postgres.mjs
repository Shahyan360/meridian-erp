import { randomUUID, randomBytes } from "node:crypto";
import { resolve, sep } from "node:path";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
const parent = resolve("artifacts");
const directory = resolve(parent, `postgres-${randomUUID()}`);
if (!directory.startsWith(parent + sep))
  throw new Error("Invalid test directory.");
await mkdir(parent, { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: "meridian_test",
  password: randomBytes(18).toString("hex"),
  port: 55439,
  persistent: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("meridian_test");
  const client = pg.getPgClient();
  const password = client.connectionParameters.password;
  await client.end();
  const env = {
    ...process.env,
    DATABASE_MODE: "postgres",
    DATABASE_URL: `postgresql://meridian_test:${password}@127.0.0.1:55439/meridian_test?connection_limit=2`,
    DEMO_MODE: "false",
    NODE_ENV: "test",
    ADMIN_EMAIL: "admin@postgres.test",
    ADMIN_PASSWORD: randomBytes(20).toString("hex"),
    CONTACT_NOTIFICATION_EMAIL: "",
    SMTP_PASS: "",
    RESEND_API_KEY: "",
  };
  for (const args of [
    ["scripts/setup.mjs"],
    ["--test", "server/test/postgres.integration.js"],
  ]) {
    const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      break;
    }
  }
} finally {
  await pg.stop();
}
