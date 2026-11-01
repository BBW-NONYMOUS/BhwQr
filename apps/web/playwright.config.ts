import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Specs that talk to Supabase directly (register-approve-login) need NEXT_PUBLIC_SUPABASE_URL.
// Values already set in the environment win over the file.
const envFile = fileURLToPath(new URL("./.env.local", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Browsers are not installed with the package: run `npx playwright install chromium` once.
 * The specs use the live (hosted) Supabase dev project and its seeded demo accounts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    timezoneId: "Asia/Manila",
    locale: "en-PH",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /register-approve-login/ },
    // Registration adds (then deactivates) a BHW, which would change the counts the other specs
    // check, so it runs after them.
    {
      name: "registration",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /register-approve-login/,
      dependencies: ["chromium"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
