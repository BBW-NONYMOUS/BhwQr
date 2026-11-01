// Smoke test of a deployed Supabase project through the public API, as each demo role.
// Needs no database password: the API keys are fetched with the logged-in Supabase CLI and are
// never printed. Exercises RLS, role guards and the main RPCs against the seeded demo data.
//
//   node scripts/smoke-remote.mjs            (uses supabase/.temp/project-ref)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (!/^[a-z]{20}$/.test(ref)) throw new Error("Unexpected project ref in supabase/.temp/project-ref");
const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} -o json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const keys = JSON.parse(raw.slice(raw.indexOf("[")));
const anon = keys.find((k) => k.name === "anon" || k.type === "publishable")?.api_key;
if (!anon) throw new Error("No anon/publishable key found for the project");
const url = `https://${ref}.supabase.co`;
const PASSWORD = "BhwDemo#2026";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "ok    " : "NOT OK"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

async function as(email) {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return client;
}

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);

// Active BHWs right now: the seed has 8, and people registered and approved by hand on the dev
// project add to that, so the per-role checks compare with this count.
const ACTIVE = await (async () => {
  const c = await as("admin@bhw.local");
  const { count } = await c.from("profiles").select("id", { count: "exact", head: true })
    .eq("role", "employee").eq("status", "active");
  await c.auth.signOut();
  return count ?? 0;
})();
check(`the 8 seeded BHWs are active (${ACTIVE} active in total)`, ACTIVE >= 8);

// anon
const anonClient = createClient(url, anon, { auth: { persistSession: false } });
{
  const { data } = await anonClient.from("profiles").select("id");
  check("anon reads no profiles", !data || data.length === 0);
  const { data: avail, error } = await anonClient.rpc("check_registration_available", {
    p_bhw_id_number: "BHW-KII-2019-001", p_email: "nobody@example.com",
  });
  check("anon registration pre-check detects a taken BHW ID", !error && avail === "BHW_ID_TAKEN", error?.message);
}

// employee
const maria = await as("maria.santos@bhw.local");
{
  const { data: me } = await maria.auth.getUser();
  const uid = me.user.id;
  const { data: profiles } = await maria.from("profiles").select("id, role, status");
  check("employee sees only own profile", profiles?.length === 1 && profiles[0].id === uid);
  const { data: rows } = await maria.from("attendance_records").select("employee_id");
  check("employee sees own attendance only", (rows?.length ?? 0) > 0 && rows.every((r) => r.employee_id === uid));
  const { error: insErr } = await maria.from("attendance_records").insert({
    employee_id: uid, work_date: "2020-01-06", time_in: new Date().toISOString(), status: "on_time", method: "qr",
  });
  check("employee cannot insert attendance (FR-61)", Boolean(insErr));
  const { error: repErr } = await maria.rpc("get_daily_summary", { p_date: today });
  check("employee cannot run reports", repErr?.message === "FORBIDDEN", repErr?.message);
  const { data: dtr, error: dtrErr } = await maria.rpc("get_dtr", { p_employee_id: uid, p_year: year, p_month: month });
  check("employee reads own DTR with 31 rows", !dtrErr && dtr?.rows?.length === 31, dtrErr?.message);
  const { data: priv, error: privErr } = await maria.rpc("get_profile_private", { p_profile_id: uid });
  check("employee decrypts own contact number", !privErr && priv?.[0]?.contact_number === "09171234501", privErr?.message);
  const { error: admErr } = await maria.rpc("reset_device", { p_employee_id: uid, p_reason: "trying to reset myself" });
  check("employee cannot call admin RPCs", admErr?.message === "FORBIDDEN", admErr?.message);
  const { data: hist, error: histErr } = await maria.rpc("get_employee_history", {
    p_employee_id: uid, p_from: `${year - 1}-01-01`, p_to: today,
  });
  check("employee history RPC works", !histErr && Array.isArray(hist), histErr?.message);
}

// viewer
const viewer = await as("viewer@bhw.local");
{
  const { data: rows } = await viewer.from("attendance_records").select("id");
  check("viewer has no direct attendance access", (rows?.length ?? 0) === 0);
  const { data: daily, error } = await viewer.rpc("get_daily_summary", { p_date: today });
  check("viewer reads the daily report (every active BHW)", !error && daily?.length === ACTIVE, error?.message ?? `${daily?.length} rows`);
  const { data: dash, error: dErr } = await viewer.rpc("get_dashboard_today");
  check("viewer dashboard hides admin-only counts", !dErr && dash?.[0]?.pending_corrections === 0, dErr?.message);
}

// kiosk
const kiosk = await as("kiosk@bhw.local");
{
  const { data: stations } = await kiosk.from("stations").select("id, name");
  check("kiosk sees exactly its station", stations?.length === 1);
  const { data: feed, error } = await kiosk.rpc("get_kiosk_feed", { p_station_id: stations?.[0]?.id });
  check("kiosk reads its live feed", !error && Array.isArray(feed), error?.message);
}

// admin
const admin = await as("admin@bhw.local");
{
  const { data: emps } = await admin.from("profiles").select("id").eq("role", "employee").eq("status", "active");
  check("admin sees every active employee", emps?.length === ACTIVE);
  const { data: dash, error } = await admin.rpc("get_dashboard_today");
  check("admin dashboard RPC", !error && dash?.[0]?.total_employees === ACTIVE, error?.message);
  const { data: monthly, error: mErr } = await admin.rpc("get_monthly_summary", { p_year: year, p_month: month });
  check("monthly summary has a row per active BHW", !mErr && monthly?.length === ACTIVE, mErr?.message);
  const { data: batch, error: bErr } = await admin.rpc("get_dtr_batch", { p_year: year, p_month: month });
  check("batch DTR has a document per active BHW", !bErr && batch?.length === ACTIVE, bErr?.message);
  const { data: audit } = await admin.from("audit_logs").select("id").limit(1);
  check("admin reads the audit log", (audit?.length ?? 0) === 1);
  const { data: trend, error: tErr } = await admin.rpc("get_attendance_trend", { p_days: 14 });
  check("14-day trend", !tErr && trend?.length === 14, tErr?.message);
  // Report totals match raw rows (AC-06) for the seeded weeks.
  const from = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const { data: raw } = await admin.from("attendance_records").select("status, work_date").gte("work_date", from).lte("work_date", today);
  const { data: weekly } = await admin.rpc("get_monthly_summary", { p_year: year, p_month: month });
  const monthRaw = raw?.filter((r) => r.work_date.startsWith(`${year}-${String(month).padStart(2, "0")}`)) ?? [];
  check(
    "monthly late count equals raw records (AC-06)",
    weekly?.reduce((s, r) => s + r.late_days, 0) === monthRaw.filter((r) => r.status === "late").length,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
