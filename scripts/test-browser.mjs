import { spawnSync } from "node:child_process";
// Each suite gets a fresh server/database, avoiding cross-browser state and
// artificial exhaustion of real application rate limits from automated logins.
const browsers = process.argv.includes("--all")
  ? ["chromium", "firefox"]
  : ["chromium"];
for (const browser of browsers) {
  for (const suite of ["accessibility", "navigation", "workspace"]) {
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        `tests/${suite}.spec.js`,
        `--project=${browser}`,
      ],
      { stdio: "inherit", env: { ...process.env, CROSS_BROWSER: "true" } },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
