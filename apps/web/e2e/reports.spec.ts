import type { Database } from "@bhw/types";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ACCOUNTS, DEMO_PASSWORD, login, parseReportNumber } from "./helpers";

/**
 * Active BHWs right now, read through the API as the demo admin. The dev project also holds
 * people registered by hand during testing, so the seeded count (8) is only the minimum.
 */
async function activeEmployeeCount(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing (apps/web/.env.local)");
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: ACCOUNTS.admin,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw signInError;
  const { count, error } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "employee")
    .eq("status", "active");
  await client.auth.signOut();
  if (error || count === null) throw error ?? new Error("no count");
  return count;
}

/** Totals panel label → column header of the on-screen table it must equal the sum of. */
const TOTAL_TO_COLUMN: Record<string, string> = {
  "Days present": "Present",
  "Late days": "Late",
  "Undertime days": "Undertime",
  "Absent days": "Absent",
  "No time-out days": "No time-out",
  "Total lateness": "Late (min)",
};

// Report generation (Phase 4 Playwright list, AC-06): the monthly report lists every active employee
// and each figure in the totals panel equals the sum of the rows shown in the table.
test("monthly report lists every employee and totals add up", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, ACCOUNTS.admin);
  await page.goto("/admin/reports?tab=monthly");

  // The page also renders a print-only table; use the one visible on screen.
  const table = page.locator("table:visible").first();
  await expect(table).toBeVisible({ timeout: 30_000 });
  const employeeRows = table.locator("tbody tr");
  const expected = await activeEmployeeCount();
  expect(expected).toBeGreaterThanOrEqual(8);
  await expect(employeeRows).toHaveCount(expected);

  const headers = (await table.locator("thead th").allTextContents()).map((h) => h.trim());
  const rows = await employeeRows.evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll("td"), (td) => td.textContent ?? "")),
  );

  const panel = page.getByRole("region", { name: /^totals for/i });
  await expect(panel).toBeVisible();
  let compared = 0;
  for (const [label, column] of Object.entries(TOTAL_TO_COLUMN)) {
    const col = headers.indexOf(column);
    if (col < 0) continue;
    const totalText = await panel
      .locator("dt", { hasText: label })
      .locator("xpath=following-sibling::dd[1]")
      .textContent();
    const total = parseReportNumber(totalText ?? "");
    expect(total, `${label} is a number`).not.toBeNull();
    const sum = rows.reduce((acc, r) => acc + (parseReportNumber(r[col] ?? "") ?? 0), 0);
    expect(total, `${label} equals the sum of "${column}"`).toBe(sum);
    compared += 1;
  }
  expect(compared, "totals compared").toBeGreaterThanOrEqual(5);

  await expect(page.getByRole("button", { name: /print/i }).first()).toBeVisible();
});
