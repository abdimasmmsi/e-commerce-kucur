import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../artifacts/playwright-qa/test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "../artifacts/playwright-qa/report", open: "never" }]],
  use: {
    baseURL: globalThis.process?.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    browserName: "chromium",
    channel: "chrome",
    locale: "id-ID",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "../backend",
      url: "http://127.0.0.1:3000/health/ready",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      cwd: ".",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
