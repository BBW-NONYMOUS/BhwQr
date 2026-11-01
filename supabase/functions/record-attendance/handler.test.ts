// Deno tests for every record-attendance failure (decisions §D) and the success path.
// Run: deno test --allow-env supabase/functions
import { assertEquals } from "jsr:@std/assert@1";
import { handleScan, IAT_SKEW_MS, type ScanDeps } from "./handler.ts";
import { signToken, verifyToken } from "../_shared/hmac.ts";
import { KIOSK_QR_PREFIX, type KioskTokenPayload } from "../_shared/schemas.ts";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";
const STATION = "b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42";
const NONCE = "8c2f4e61-0d9a-4b7e-a3c5-9f1e2d7b6a04";
const USER = "3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10";
const DEVICE = "6f1c1d4e-2b7a-4c1e-9a55-2f3b9d8e7a10";
const NOW = 1_793_520_000_000;

async function token(overrides: Partial<KioskTokenPayload> = {}, secret = SECRET) {
  return await signToken(KIOSK_QR_PREFIX, {
    v: 1, sid: STATION, n: NONCE, iat: NOW - 1_000, exp: NOW + 29_000, ...overrides,
  }, secret);
}

function request(body: unknown, auth = true): Request {
  return new Request("http://localhost/record-attendance", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer x" } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function body(t: string, extra: Record<string, unknown> = {}) {
  return { token: t, deviceId: DEVICE, lat: 6.6311, lng: 124.6047, accuracy: 10, ...extra };
}

interface Captured { attempts: string[]; recordArgs: Parameters<ScanDeps["recordScan"]>[0] | null }

function deps(
  overrides: Partial<ScanDeps> = {},
  dbResult: Awaited<ReturnType<ScanDeps["recordScan"]>> = {
    ok: true, action: "time_in", time: "08:01", status: "on_time", workDate: "2026-11-09",
  },
): { deps: ScanDeps; captured: Captured } {
  const captured: Captured = { attempts: [], recordArgs: null };
  return {
    captured,
    deps: {
      now: () => NOW,
      getCallerId: (r) => Promise.resolve(r.headers.get("authorization") ? USER : null),
      countRecentAttempts: () => Promise.resolve(0),
      logAttempt: (e) => { captured.attempts.push(e.code); return Promise.resolve(); },
      hashDevice: () => Promise.resolve("a".repeat(64)),
      verify: (t) => verifyToken<KioskTokenPayload>(KIOSK_QR_PREFIX, t, [SECRET]),
      recordScan: (a) => { captured.recordArgs = a; return Promise.resolve(dbResult); },
      reportAnomaly: () => Promise.resolve(),
      logError: () => Promise.resolve(),
      ...overrides,
    },
  };
}

async function code(res: Response): Promise<string> {
  const j = await res.json();
  return j.ok ? "OK" : j.code;
}

Deno.test("step 1: AUTH_REQUIRED without a JWT (401, attempt logged)", async () => {
  const { deps: d, captured } = deps();
  const res = await handleScan(request(await body(await token()), false), d);
  assertEquals(res.status, 401);
  assertEquals(await code(res), "AUTH_REQUIRED");
  assertEquals(captured.attempts, ["AUTH_REQUIRED"]);
});

Deno.test("step 2: RATE_LIMITED after 10 attempts in a minute (429)", async () => {
  const { deps: d } = deps({ countRecentAttempts: () => Promise.resolve(10) });
  const res = await handleScan(request(await body(await token())), d);
  assertEquals(res.status, 429);
  assertEquals(await code(res), "RATE_LIMITED");
});

Deno.test("step 3: INVALID_REQUEST for a malformed body", async () => {
  const { deps: d } = deps();
  for (const bad of ["not json", { token: "BHWQR1:x.y" }, await body("https://evil.example")]) {
    const res = await handleScan(request(bad), d);
    assertEquals(res.status, 400);
    assertEquals(await code(res), "INVALID_REQUEST");
  }
});

for (const dbCode of [
  "ACCOUNT_NOT_ACTIVE", "DEVICE_NOT_BOUND", "DEVICE_MISMATCH", "QR_UNKNOWN", "QR_REUSED",
  "STATION_INACTIVE", "GPS_INACCURATE", "OUTSIDE_GEOFENCE", "COOLDOWN_ACTIVE",
  "ALREADY_COMPLETED", "SELFIE_REQUIRED",
]) {
  Deno.test(`steps 4-15: ${dbCode} from record_scan is returned with its HTTP status`, async () => {
    const params: Record<string, number> = dbCode === "OUTSIDE_GEOFENCE" ? { distance: 240, radius: 100 } : {};
    const { deps: d } = deps({}, { ok: false, code: dbCode, params });
    const res = await handleScan(request(await body(await token())), d);
    const j = await res.json();
    assertEquals(j.code, dbCode);
    const expected: Record<string, number> = {
      ACCOUNT_NOT_ACTIVE: 403, DEVICE_NOT_BOUND: 403, DEVICE_MISMATCH: 403, QR_UNKNOWN: 400,
      QR_REUSED: 409, STATION_INACTIVE: 400, GPS_INACCURATE: 400, OUTSIDE_GEOFENCE: 403,
      COOLDOWN_ACTIVE: 429, ALREADY_COMPLETED: 409, SELFIE_REQUIRED: 400,
    };
    assertEquals(res.status, expected[dbCode]);
    if (dbCode === "OUTSIDE_GEOFENCE") assertEquals(j.message.includes("240 m"), true);
  });
}

Deno.test("step 6: forged signature -> tokenValid=false passed to record_scan", async () => {
  const { deps: d, captured } = deps();
  await handleScan(request(await body(await token({}, "wrong-secret-wrong-secret-wrong"))), d);
  assertEquals(captured.recordArgs?.tokenValid, false);
});

Deno.test("step 7: screenshot older than 30 s -> tokenExpired=true", async () => {
  const { deps: d, captured } = deps();
  await handleScan(request(await body(await token({ iat: NOW - 45_000, exp: NOW - 15_000 }))), d);
  assertEquals(captured.recordArgs?.tokenValid, true);
  assertEquals(captured.recordArgs?.tokenExpired, true);
});

Deno.test("step 7: iat too far in the future -> tokenExpired=true", async () => {
  const { deps: d, captured } = deps();
  await handleScan(
    request(await body(await token({ iat: NOW + IAT_SKEW_MS + 1_000, exp: NOW + 40_000 }))), d);
  assertEquals(captured.recordArgs?.tokenExpired, true);
});

Deno.test("QR_INVALID and QR_EXPIRED from record_scan map to 400", async () => {
  for (const c of ["QR_INVALID", "QR_EXPIRED"]) {
    const { deps: d } = deps({}, { ok: false, code: c });
    const res = await handleScan(request(await body(await token())), d);
    assertEquals(res.status, 400);
    assertEquals(await code(res), c);
  }
});

Deno.test("INTERNAL_ERROR when the database call throws (500, error logged)", async () => {
  let logged = false;
  const { deps: d } = deps({
    recordScan: () => Promise.reject(new Error("db down")),
    logError: () => { logged = true; return Promise.resolve(); },
  });
  const res = await handleScan(request(await body(await token())), d);
  assertEquals(res.status, 500);
  assertEquals(await code(res), "INTERNAL_ERROR");
  assertEquals(logged, true);
});

Deno.test("success returns the action and a friendly message", async () => {
  const { deps: d, captured } = deps();
  const res = await handleScan(request(await body(await token())), d);
  const j = await res.json();
  assertEquals(res.status, 200);
  assertEquals(j.ok, true);
  assertEquals(j.message, "Time-in recorded at 08:01 – on time.");
  assertEquals(captured.recordArgs?.stationId, STATION);
  assertEquals(captured.recordArgs?.nonce, NONCE);
});

Deno.test("previous secret is accepted during rotation", async () => {
  const t = await token({}, "old-secret-0123456789abcdef0123456789");
  const r = await verifyToken<KioskTokenPayload>(KIOSK_QR_PREFIX, t, [SECRET, "old-secret-0123456789abcdef0123456789"]);
  assertEquals(r.ok, true);
});
