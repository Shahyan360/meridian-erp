import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { demoDatabaseUrl } from "../shared/database-url.js";
import { spawnSync } from "node:child_process";
import "dotenv/config";
import { databaseMode } from "../shared/database-config.js";

const mode = databaseMode();
const demo = mode === "demo";
const demoUrl = demoDatabaseUrl();
if (demo && !existsSync(demoUrl.slice(5))) writeFileSync(demoUrl.slice(5), "");
if (demo) {
  const source = readFileSync("prisma/schema.prisma", "utf8")
    .replace(
      'provider = "prisma-client-js"',
      'provider = "prisma-client-js"\n  output = "../generated/demo-client"',
    )
    .replace('provider = "mysql"', 'provider = "sqlite"')
    .replace('env("DATABASE_URL")', 'env("DEMO_DATABASE_URL")')
    .replace(/\s+@db\.\w+(?:\([^)]*\))?/g, "");
  writeFileSync("prisma/demo.prisma", source);
}
if (mode === "postgres") {
  writeFileSync(
    "prisma/postgres.prisma",
    readFileSync("prisma/schema.prisma", "utf8")
      .replace(
        'provider = "prisma-client-js"',
        'provider = "prisma-client-js"\n  output = "../generated/postgres-client"',
      )
      .replace('provider = "mysql"', 'provider = "postgresql"'),
  );
}
const action = process.argv[2] || "generate";
const args = [
  "node_modules/prisma/build/index.js",
  ...(action === "push" ? ["db", "push"] : ["generate"]),
  "--schema",
  demo
    ? "prisma/demo.prisma"
    : mode === "postgres"
      ? "prisma/postgres.prisma"
      : "prisma/schema.prisma",
];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL || "mysql://unused:unused@localhost/unused",
    DEMO_DATABASE_URL: demoUrl,
  },
});
process.exit(result.status ?? 1);
