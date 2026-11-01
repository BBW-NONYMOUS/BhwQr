import { expect, type Locator, type Page } from "@playwright/test";

/** Seeded demo accounts (supabase/seed.sql). Local/demo data only. */
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "BhwDemo#2026";
export const ACCOUNTS = {
  admin: "admin@bhw.local",
  kiosk: "kiosk@bhw.local",
  employee: "maria.santos@bhw.local",
  viewer: "viewer@bhw.local",
} as const;

/** Signs in through /login and waits until the app has left the login page. */
export async function login(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^(log ?in|sign in)/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Ends the session without depending on where the sign-out button lives. */
export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page.getByLabel(/^email/i)).toBeVisible();
}

/**
 * Fills a form control found by label whether it is a text input or a shadcn Select
 * (a combobox button): for a Select the option matching `value` is picked, or the first one.
 */
export async function fillOrSelect(page: Page, field: Locator, value: string | RegExp): Promise<void> {
  const role = await field.getAttribute("role");
  const tag = await field.evaluate((el) => el.tagName.toLowerCase());
  if (role === "combobox" && tag !== "input") {
    await field.click();
    const options = page.getByRole("option");
    const match = options.filter({ hasText: value });
    await ((await match.count()) > 0 ? match.first() : options.first()).click();
  } else if (tag === "select") {
    const options = await field.locator("option").allTextContents();
    const label = options.find((o) => (typeof value === "string" ? o.includes(value) : value.test(o)));
    await field.selectOption(label ? { label } : { index: 1 });
  } else {
    await field.fill(typeof value === "string" ? value : value.source);
  }
}

/**
 * Parses a number shown in a report cell: "12", "1,204", "2 h 15 min" / "45 min" (as minutes).
 * Returns null for anything else (names, dates, dashes).
 */
export function parseReportNumber(text: string): number | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (/^-?[\d,]+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ""));
  const hm = /^(?:(\d+) h)?(?: ?(\d+) min)?$/.exec(t);
  if (hm && (hm[1] || hm[2])) return Number(hm[1] ?? 0) * 60 + Number(hm[2] ?? 0);
  return null;
}
