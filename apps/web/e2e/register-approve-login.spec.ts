import type { Database } from "@bhw/types";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ACCOUNTS, DEMO_PASSWORD, fillOrSelect, login, logout } from "./helpers";

// Core flows 1–2: register → (e-mail confirmed) → admin approves with the seeded schedule →
// the new BHW signs in and lands on /me.
//
// With E2E_SERVICE_ROLE_KEY set, the test confirms the address through the Admin API and deletes
// the user afterwards (needed when "Confirm email" is on). Without it, the dev project must have
// "Confirm email" off. Never set that variable in a shared CI log or commit it.

const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SEEDED_SCHEDULE = /Regular Mon/i;

const stamp = Date.now();
const newUser = {
  fullName: `E2E Tester ${stamp}`,
  bhwId: `E2E-${String(stamp).slice(-8)}`,
  area: "Purok 1",
  contact: "09171234567",
  email: `e2e+${stamp}@bhw.local`,
  password: `E2e#${stamp}`,
};

/** 1×1 PNG for an optional photo field. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.describe.serial("register → approve → login", () => {
  let admin: SupabaseClient<Database> | null = null;
  let createdUserId: string | null = null;

  test.afterAll(async () => {
    if (admin && createdUserId) {
      const { error } = await admin.auth.admin.deleteUser(createdUserId);
      if (error) console.warn(`Cleanup failed for ${newUser.email}: ${error.message}`);
      return;
    }
    // Without the service key the account cannot be deleted; deactivate it as the demo admin so it
    // does not count as an active BHW in reports and the dashboard.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !anonKey) return;
    const client = createClient<Database>(SUPABASE_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({
      email: ACCOUNTS.admin,
      password: DEMO_PASSWORD,
    });
    if (signInError) return console.warn(`Cleanup sign-in failed: ${signInError.message}`);
    const { data: profile } = await client
      .from("profiles")
      .select("id, status")
      .eq("email", newUser.email)
      .maybeSingle();
    if (profile?.status === "active") {
      const { error } = await client.rpc("deactivate_employee", {
        p_employee_id: profile.id,
        p_reason: "Automated registration test account (e2e cleanup)",
      });
      if (error) console.warn(`Cleanup failed for ${newUser.email}: ${error.message}`);
    }
    await client.auth.signOut();
  });

  test("a BHW registers and sees the success screen", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/register");

    await page.getByLabel(/full name/i).fill(newUser.fullName);
    await page.getByLabel(/bhw id/i).fill(newUser.bhwId);
    await fillOrSelect(page, page.getByLabel(/purok|area/i).first(), newUser.area);
    await page
      .getByLabel(/contact|mobile/i)
      .first()
      .fill(newUser.contact);

    // Step 1 (Personal details): a profile photo is required (BR-12a) before moving on.
    const next = page.getByRole("button", { name: /^next/i });
    await next.click();
    await expect(page.getByText(/profile photo is required/i).first()).toBeVisible();

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_1PX });
    await next.click();

    // Step 2 (Account).
    await page.getByLabel(/^e-?mail/i).fill(newUser.email);
    await page.getByLabel(/^password/i).fill(newUser.password);
    await page.getByLabel(/confirm password/i).fill(newUser.password);
    await page.getByRole("checkbox", { name: /privacy|consent|agree/i }).check();
    await page.getByRole("button", { name: /^(register|create account|submit)/i }).click();

    await expect(
      page
        .getByText(
          /registration (submitted|received|sent)|check your e-?mail|waiting for approval|pending approval/i,
        )
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("an admin approves the registration and the BHW lands on /me", async ({ page }) => {
    test.setTimeout(120_000);

    if (SERVICE_ROLE_KEY && SUPABASE_URL) {
      admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Find the user created by the previous test and confirm the e-mail address.
      const { data: list, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      expect(listError).toBeNull();
      const user = list.users.find((u) => u.email === newUser.email);
      expect(user, `auth user ${newUser.email}`).toBeDefined();
      createdUserId = user!.id;
      const { error: confirmError } = await admin.auth.admin.updateUserById(createdUserId, {
        email_confirm: true,
      });
      expect(confirmError).toBeNull();
    }
    // Without the key the project must have "Confirm email" off (dev only); the account then
    // stays in the dev database afterwards as an approved "E2E Tester".

    // Before approval the BHW can sign in but only reaches the pending page (AC-01).
    await login(page, newUser.email, newUser.password);
    await expect(page).toHaveURL(/\/pending$/);
    // The registration photo was saved: the card offers "Change photo", not "Add photo".
    await expect(page.getByRole("button", { name: /change photo/i })).toBeVisible();
    await logout(page);

    // Admin approves on /admin/approvals with the seeded schedule.
    await login(page, ACCOUNTS.admin);
    await page.goto("/admin/approvals");
    const entry = page
      .getByRole("row")
      .or(page.getByRole("listitem"))
      .or(page.getByRole("article"))
      .filter({ hasText: newUser.fullName })
      .first();
    await expect(entry).toBeVisible({ timeout: 30_000 });
    await entry.getByRole("button", { name: /^approve/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const schedule = dialog
      .getByRole("combobox")
      .or(dialog.getByLabel(/schedule/i))
      .first();
    if ((await schedule.count()) > 0) await fillOrSelect(page, schedule, SEEDED_SCHEDULE);
    await dialog.getByRole("button", { name: /^(approve|confirm)/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(newUser.fullName)).toHaveCount(0, { timeout: 15_000 });

    if (admin && createdUserId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("status")
        .eq("id", createdUserId)
        .single();
      expect(profile?.status).toBe("active");
    }

    // The approved BHW signs in and lands on the employee page.
    await logout(page);
    await login(page, newUser.email, newUser.password);
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { level: 1, name: /hello/i })).toBeVisible();
  });
});
