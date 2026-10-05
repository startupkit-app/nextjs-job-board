import { defineConfig } from "@playwright/test";

if (!process.env.KIT_TEST_SITE_URL || !process.env.KIT_TEST_API_URL) {
  throw new Error("Run browser tests through npm run test:browser (mock API only).");
}

const mode = process.env.KIT_TEST_BASE_PATH ? "careers" : "root";

export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: `test-results/${mode}`,
  reporter: [["list"], ["html", { outputFolder: `playwright-report/${mode}`, open: "never" }]],
  projects: [{ name: mode, use: { browserName: "chromium" } }],
  use: {
    baseURL: process.env.KIT_TEST_SITE_URL,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
