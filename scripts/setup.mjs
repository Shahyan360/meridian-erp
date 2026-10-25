import { spawnSync } from "node:child_process";
for (const args of [
  ["scripts/database.mjs", "generate"],
  ["scripts/database.mjs", "push"],
  ["server/src/seed.js"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
