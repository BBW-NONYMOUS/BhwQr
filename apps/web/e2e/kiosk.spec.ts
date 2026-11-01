import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./helpers";

// Core flow 3: the kiosk account lands on its station, sees a QR that is replaced every
// refreshSeconds (15 s), a countdown, the Manila clock and the recent-scan feed.
test.describe("kiosk QR station", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.kiosk);
    // HOME_BY_ROLE.kiosk is /kiosk, which redirects a kiosk account to its linked station.
    await page.goto("/kiosk");
    await page.waitForURL(/\/kiosk\/[0-9a-f-]{36}$/);
  });

  test("shows a QR that refreshes with a countdown", async ({ page }) => {
    test.setTimeout(90_000);

    const qr = page.getByRole("img", { name: /attendance qr code for/i });
    await expect(qr).toHaveAttribute("data-qr-issued-at", /^\d+$/, { timeout: 20_000 });
    await expect(qr.locator("svg").first()).toBeVisible();
    const firstIssuedAt = await qr.getAttribute("data-qr-issued-at");

    await expect(page.getByRole("progressbar", { name: /time until the next qr code/i })).toBeVisible();
    await expect(page.getByText(/New code in \d+ s/)).toBeVisible();
    await expect(page.getByText("Open the BHW Attendance app and scan this code")).toBeVisible();
    await expect(page.getByText("Buksan ang BHW Attendance app at i-scan ang code na ito")).toBeVisible();
    await expect(page.getByRole("heading", { name: /recent scans/i })).toBeVisible();
    // Clock comes from server time (HH:mm:ss) once the first response arrived.
    await expect(page.locator("time").first()).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

    // A new token replaces the QR within one refresh interval (15 s) plus network time.
    await expect
      .poll(() => qr.getAttribute("data-qr-issued-at"), { timeout: 20_000, intervals: [500] })
      .not.toBe(firstIssuedAt);
    await expect(qr.locator("svg").first()).toBeVisible();
  });

  test("shows the offline banner and recovers on reconnect", async ({ page, context }) => {
    test.setTimeout(60_000);
    const qr = page.getByRole("img", { name: /attendance qr code/i });
    await expect(qr).toHaveAttribute("data-qr-issued-at", /^\d+$/, { timeout: 20_000 });
    const before = await qr.getAttribute("data-qr-issued-at");

    await context.setOffline(true);
    await expect(page.getByRole("alert").filter({ hasText: "Offline – scans cannot be recorded" })).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByRole("alert").filter({ hasText: "Offline" })).toHaveCount(0, { timeout: 15_000 });
    // FR-118: a fresh token is requested immediately on reconnect.
    await expect
      .poll(
        async () => {
          const issuedAt = await qr.getAttribute("data-qr-issued-at");
          return issuedAt !== null && issuedAt !== before;
        },
        { timeout: 15_000, intervals: [500] },
      )
      .toBe(true);
  });
});
