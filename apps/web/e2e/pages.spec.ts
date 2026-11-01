import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, login } from "./helpers";

// Every portal page renders for its role without the error screen. Catches server/client boundary
// mistakes (e.g. non-serialisable props) that type checks and unit tests cannot see.
const ADMIN_PAGES = [
  "/admin",
  "/admin/employees",
  "/admin/approvals",
  "/admin/attendance",
  "/admin/corrections",
  "/admin/fallback-scan",
  "/admin/dtr",
  "/admin/reports?tab=daily",
  "/admin/reports?tab=weekly",
  "/admin/reports?tab=monthly",
  "/admin/schedules",
  "/admin/holidays",
  "/admin/stations",
  "/admin/settings",
  "/admin/device-health",
  "/admin/error-logs",
  "/admin/audit-log",
];

async function expectRenders(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} HTTP status`).toBeLessThan(500);
  await expect(page.locator("h1").first(), `${path} heading`).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/this page couldn.t load|something went wrong/i), `${path} error screen`).toHaveCount(0);
}

test("every admin page renders", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, ACCOUNTS.admin);
  for (const path of ADMIN_PAGES) await expectRenders(page, path);
});

test("viewer pages render", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, ACCOUNTS.viewer);
  for (const path of ["/viewer", "/viewer/reports?tab=monthly"]) await expectRenders(page, path);
});

test("employee /me renders", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, ACCOUNTS.employee);
  await expectRenders(page, "/me");
});
