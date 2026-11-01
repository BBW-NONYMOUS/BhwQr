// End-to-end check of the deployed Edge Functions with the demo accounts:
// kiosk issues a QR → an unbound BHW binds a phone → scans (time-in) → reuse/geofence/GPS/expired
// failures → heartbeat → log-error → DTR PDF. Writes a real time-in for today for the demo BHW
// "Lorna T. Bautista" (dev/demo project only). Needs the Edge Function secrets to be set.
//
//   node scripts/smoke-functions.mjs
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (!/^[a-z]{20}$/.test(ref)) throw new Error("Unexpected project ref");
const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} -o json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const anon = JSON.parse(raw.slice(raw.indexOf("["))).find((k) => k.name === "anon")?.api_key;
const url = `https://${ref}.supabase.co`;
const fn = `${url}/functions/v1`;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  ok ? (passed += 1) : (failed += 1);
  console.log(`${ok ? "ok    " : "NOT OK"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
};

async function session(email) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "BhwDemo#2026" });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client: c, token: data.session.access_token };
}

async function call(name, token, body) {
  const res = await fetch(`${fn}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : await res.arrayBuffer() };
}

const kiosk = await session("kiosk@bhw.local");
const { data: station } = await kiosk.client.from("stations").select("id, latitude, longitude").single();
const lat = Number(station.latitude);
const lng = Number(station.longitude);

// Kiosk QR + heartbeat
const qr = await call("issue-qr-token", kiosk.token, { stationId: station.id });
check("kiosk issues a signed QR", qr.status === 200 && qr.body.content?.startsWith("BHWQR1:"), JSON.stringify(qr.body).slice(0, 200));
check("QR lifetime is 30 s", qr.body.expiresAt - qr.body.issuedAt === 30_000);
const hb = await call("kiosk-heartbeat", kiosk.token, {
  stationId: station.id, appVersion: "smoke", clientNow: Date.now(), lastTokenAt: qr.body.issuedAt,
});
check("kiosk heartbeat accepted", hb.status === 200 && hb.body.ok === true, JSON.stringify(hb.body));

// Employee: bind + scan
const lorna = await session("lorna.bautista@bhw.local");
// Same fixed test installation ID as scripts/perf-check.mjs, so repeated runs reuse one binding
// and every scan rule is exercised. If a real phone is bound, the scan checks report DEVICE_MISMATCH.
const deviceId = "7e3f9a2c-5b1d-4c8e-9f60-0a1b2c3d4e5f";
const bind = await call("bind-device", lorna.token, { deviceId, platform: "android", model: "Smoke Test Phone", appVersion: "smoke" });
const alreadyBound = bind.body.code === "DEVICE_MISMATCH";
check("BHW binds the test phone (or it is already bound)", bind.status === 200 || alreadyBound, JSON.stringify(bind.body));

const noAuth = await call("record-attendance", null, { token: qr.body.content, deviceId, lat, lng, accuracy: 10 });
check("scan without login → AUTH_REQUIRED 401", noAuth.status === 401 && noAuth.body.code === "AUTH_REQUIRED");

const far = await call("record-attendance", lorna.token, { token: qr.body.content, deviceId, lat: lat + 0.003, lng, accuracy: 10 });
check("scan 330 m away → OUTSIDE_GEOFENCE 403", far.body.code === (alreadyBound ? "DEVICE_MISMATCH" : "OUTSIDE_GEOFENCE"), JSON.stringify(far.body));

const fuzzy = await call("record-attendance", lorna.token, { token: qr.body.content, deviceId, lat, lng, accuracy: 120 });
check("scan with 120 m GPS accuracy → GPS_INACCURATE", fuzzy.body.code === (alreadyBound ? "DEVICE_MISMATCH" : "GPS_INACCURATE"));

const forged = qr.body.content.slice(0, -4) + "AAAA";
const bad = await call("record-attendance", lorna.token, { token: forged, deviceId, lat, lng, accuracy: 10 });
check("forged QR → QR_INVALID", bad.body.code === (alreadyBound ? "DEVICE_MISMATCH" : "QR_INVALID"));

if (!alreadyBound) {
  const ok = await call("record-attendance", lorna.token, { token: qr.body.content, deviceId, lat, lng, accuracy: 10 });
  const expected = ok.status === 200 || ["COOLDOWN_ACTIVE", "ALREADY_COMPLETED"].includes(ok.body.code);
  check("valid scan records time-in/out", expected, JSON.stringify(ok.body));
  const again = await call("record-attendance", lorna.token, { token: qr.body.content, deviceId, lat, lng, accuracy: 10 });
  // A refused scan does not consume the QR; reuse can only be tested after an accepted one.
  const reuseExpected = ok.status === 200 ? "QR_REUSED" : ok.body.code;
  check(`same QR again → ${reuseExpected}${ok.status === 200 ? " (AC-03)" : " (day already complete)"}`, again.body.code === reuseExpected, JSON.stringify(again.body));
  const other = await call("record-attendance", lorna.token, { token: qr.body.content, deviceId: randomUUID(), lat, lng, accuracy: 10 });
  check("another phone → DEVICE_MISMATCH", other.body.code === "DEVICE_MISMATCH");
  const pqr = await call("issue-personal-qr", lorna.token, { deviceId });
  check("personal fallback QR issued on the bound phone", pqr.status === 200 && pqr.body.content?.startsWith("BHWPQR1:"));
}

// Error logging and DTR PDF
const log = await call("log-error", lorna.token, { source: "mobile", severity: "info", message: "smoke-functions check", context: { run: "smoke" } });
check("log-error stores a mobile error", log.status === 200 && log.body.ok === true, JSON.stringify(log.body));
const { data: me } = await lorna.client.auth.getUser();
const now = new Date();
const pdf = await call("generate-dtr-pdf", lorna.token, { employeeId: me.user.id, year: now.getFullYear(), month: now.getMonth() + 1 });
const bytes = pdf.body instanceof ArrayBuffer ? new Uint8Array(pdf.body) : new Uint8Array();
check("DTR PDF generated", pdf.status === 200 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF", `status ${pdf.status}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
