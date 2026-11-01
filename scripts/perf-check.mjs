// Performance check against a deployed DEV/STAGING project (writes demo data; never production).
//  - Scan response: time from sending record-attendance to its response (target < 3 s, NFR-02).
//  - Dashboard data path: time from sending a scan to the Realtime INSERT event on scan_attempts
//    that the admin dashboard subscribes to (target: dashboard updated < 2 s, AC-05; the dashboard
//    adds a 300 ms debounce + a server refresh on top of this event).
// Uses the demo BHW lorna.bautista@bhw.local: resets her device as admin (audited) and binds a
// fixed test installation ID, so a real phone must be re-bound by an admin reset afterwards.
//
//   node scripts/perf-check.mjs [scans=8]
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SCANS = Number(process.argv[2] ?? 8);
const TEST_DEVICE_ID = "7e3f9a2c-5b1d-4c8e-9f60-0a1b2c3d4e5f";
const PASSWORD = "BhwDemo#2026";

const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (!/^[a-z]{20}$/.test(ref)) throw new Error("Unexpected project ref");
const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} -o json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const anon = JSON.parse(raw.slice(raw.indexOf("["))).find((k) => k.name === "anon")?.api_key;
const url = `https://${ref}.supabase.co`;

async function session(email) {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, token: data.session.access_token, uid: data.user.id };
}

async function call(name, token, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const pct = (values, p) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

const admin = await session("admin@bhw.local");
const kiosk = await session("kiosk@bhw.local");
const lorna = await session("lorna.bautista@bhw.local");
const { data: station } = await kiosk.client.from("stations").select("id, latitude, longitude").single();

// Bind the test installation ID (reset first if another phone is bound).
let bind = await call("bind-device", lorna.token, { deviceId: TEST_DEVICE_ID, platform: "android", model: "perf-check", appVersion: "perf" });
if (!bind.body.ok && bind.body.code === "DEVICE_MISMATCH") {
  const { error } = await admin.client.rpc("reset_device", {
    p_employee_id: lorna.uid,
    p_reason: "Performance check binds a fixed test device",
  });
  if (error) throw new Error(`reset_device: ${error.message}`);
  bind = await call("bind-device", lorna.token, { deviceId: TEST_DEVICE_ID, platform: "android", model: "perf-check", appVersion: "perf" });
}
if (!bind.body.ok) throw new Error(`bind-device: ${JSON.stringify(bind.body)}`);

// Admin dashboard data path: Realtime INSERTs on scan_attempts for this employee.
const sentAt = new Map();
const realtime = [];
const channel = admin.client
  .channel("perf-check")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_attempts", filter: `employee_id=eq.${lorna.uid}` }, (payload) => {
    const nonce = payload.new.nonce;
    if (sentAt.has(nonce)) realtime.push(Date.now() - sentAt.get(nonce));
  });
await new Promise((resolve, reject) => {
  channel.subscribe((status) => (status === "SUBSCRIBED" ? resolve() : status === "CHANNEL_ERROR" ? reject(new Error(status)) : null));
});

const scanTimes = [];
const outcomes = {};
for (let i = 0; i < SCANS; i += 1) {
  const qr = await call("issue-qr-token", kiosk.token, { stationId: station.id });
  const nonce = JSON.parse(Buffer.from(qr.body.content.slice("BHWQR1:".length).split(".")[0], "base64url").toString()).n;
  sentAt.set(nonce, Date.now());
  const t0 = performance.now();
  const res = await call("record-attendance", lorna.token, {
    token: qr.body.content,
    deviceId: TEST_DEVICE_ID,
    lat: Number(station.latitude),
    lng: Number(station.longitude),
    accuracy: 10,
    appVersion: "perf",
  });
  scanTimes.push(performance.now() - t0);
  const key = res.body.ok ? res.body.action : res.body.code;
  outcomes[key] = (outcomes[key] ?? 0) + 1;
  await new Promise((r) => setTimeout(r, 7000)); // stay under the 10 scans/min rate limit
}
await new Promise((r) => setTimeout(r, 2000));
await admin.client.removeChannel(channel);

const fmt = (ms) => `${Math.round(ms)} ms`;
console.log(JSON.stringify({
  scans: SCANS,
  outcomes,
  scanResponse: { p50: fmt(pct(scanTimes, 50)), p95: fmt(pct(scanTimes, 95)), max: fmt(Math.max(...scanTimes)), targetMs: 3000 },
  realtimeEvent: realtime.length
    ? { received: realtime.length, p50: fmt(pct(realtime, 50)), p95: fmt(pct(realtime, 95)), max: fmt(Math.max(...realtime)) }
    : { received: 0 },
}, null, 2));
