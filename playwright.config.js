import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: "list",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    ...(process.env.CROSS_BROWSER === "true"
      ? [{ name: "firefox", use: { browserName: "firefox" } }]
      : []),
  ],
  use: {
    baseURL: "http://127.0.0.1:4100",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:4100/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
