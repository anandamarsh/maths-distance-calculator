import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 420_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:4001",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4001",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
