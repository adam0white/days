import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.DAYS_TEST_URL ?? "http://127.0.0.1:4179",
    trace: "retain-on-failure",
  },
  webServer: process.env.DAYS_TEST_URL
    ? undefined
    : {
        command: "pnpm build && pnpm exec wrangler dev --local --port 4179",
        url: "http://127.0.0.1:4179",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium-phone",
      use: { browserName: "chromium", viewport: { width: 360, height: 690 } },
    },
    {
      name: "chromium-desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    { name: "webkit-phone", use: { browserName: "webkit", viewport: { width: 360, height: 690 } } },
    {
      name: "webkit-desktop",
      use: { browserName: "webkit", viewport: { width: 1280, height: 800 } },
    },
  ],
});
