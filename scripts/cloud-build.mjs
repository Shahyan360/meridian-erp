import "dotenv/config";
import { spawnSync } from "node:child_process";
import {
  databaseMode,
  assertCloudConfiguration,
} from "../shared/database-config.js";
if (databaseMode() === "demo")
  throw new Error(
    "Cloud builds require DATABASE_MODE=postgres or mysql and a persistent DATABASE_URL.",
  );
assertCloudConfiguration();
for (const args of [
  ["scripts/database.mjs", "generate"],
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "client/vite.config.js",
    "client",
  ],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
