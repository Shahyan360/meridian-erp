import "dotenv/config";
import { spawnSync, spawn } from "node:child_process";
import { assertCloudConfiguration } from "../shared/database-config.js";
assertCloudConfiguration();
for (const args of [["scripts/database.mjs", "push"], ["server/src/seed.js"]]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const child = spawn(process.execPath, ["server/src/index.js"], {
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
