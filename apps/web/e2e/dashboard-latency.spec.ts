import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ACCOUNTS, DEMO_PASSWORD, login } from "./helpers";

// AC-05: "The admin dashboard updates within 2 seconds of a successful scan."
// Opt-in (PERF=1): it writes a real scan for a demo BHW (PERF_BHW, default fatima.abdullah@bhw.local)
// on the dev project and binds a fixed test device to them (an admin reset is needed before a real
// phone). Each run needs a BHW who can scan now (no completed day, cooldown over).
test.skip(!process.env.PERF, "set PERF=1 to run the dashboard latency check (writes demo data)");

const BHW_EMAIL = process.env.PERF_BHW ?? "fatima.abdullah@bhw.local";
// One test installation ID per account: a device hash can be active for only one employee (D-06).
const h = createHash("sha256").update(`perf-check:${BHW_EMAIL}`).digest("hex");
const TEST_DEVICE_ID = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;

test("admin dashboard shows a successful scan within 2 seconds (AC-05)", async ({ page }) => {
  test.setTimeout(120_000);
  const ref = readFileSync("../../supabase/.temp/project-ref", "utf8").trim();
  if (!/^[a-z]{20}$/.test(ref)) throw new Error("Unexpected project ref");
  const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} -o json`, {
    cwd: "../..",
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const anon = JSON.parse(raw.slice(raw.indexOf("["))).find((k: { name: string }) => k.name === "anon").api_key as string;
  const url = `https://${ref}.supabase.co`;
  const call = async (name: string, token: string, body: unknown) => {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  };
  const signIn = async (email: string) => {
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) throw error;
    return { client, token: data.session.access_token, uid: data.user.id };
  };

  const admin = await signIn(ACCOUNTS.admin);
  const kiosk = await signIn(ACCOUNTS.kiosk);
  const bhw = await signIn(BHW_EMAIL);
  const { data: station } = await kiosk.client.from("stations").select("id, latitude, longitude").single();
  if (!station) throw new Error("No station");

  let bind = await call("bind-device", bhw.token, { deviceId: TEST_DEVICE_ID, platform: "android", model: "perf-check", appVersion: "perf" });
  if (!bind.ok && bind.code === "DEVICE_MISMATCH") {
    await admin.client.rpc("reset_device", { p_employee_id: bhw.uid, p_reason: "Dashboard latency check binds a test device" });
    bind = await call("bind-device", bhw.token, { deviceId: TEST_DEVICE_ID, platform: "android", model: "perf-check", appVersion: "perf" });
  }
  expect(bind.ok, JSON.stringify(bind)).toBe(true);

  await login(page, ACCOUNTS.admin);
  await page.goto("/admin");
  // Wait until the Realtime channel is subscribed before scanning.
  await expect(page.getByRole("status", { name: /live updates on/i })).toBeVisible({ timeout: 30_000 });
  const { data: me } = await bhw.client.from("profiles").select("full_name").eq("id", bhw.uid).single();
  const name = me?.full_name ?? "";
  const liveList = page.getByRole("list", { name: /latest successful scans/i });
  const before = await liveList.getByText(name).count();

  const qr = await call("issue-qr-token", kiosk.token, { stationId: station.id });
  const scan = await call("record-attendance", bhw.token, {
    token: qr.content,
    deviceId: TEST_DEVICE_ID,
    lat: Number(station.latitude),
    lng: Number(station.longitude),
    accuracy: 10,
  });
  const scanSucceededAt = Date.now();
  expect(scan.ok, `scan must succeed for this check: ${JSON.stringify(scan)}`).toBe(true);

  await expect
    .poll(async () => liveList.getByText(name).count(), { timeout: 10_000, intervals: [50] })
    .toBeGreaterThan(before);
  const elapsed = Date.now() - scanSucceededAt;
  console.log(`AC-05 dashboard update after a successful scan: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(2000);
});
