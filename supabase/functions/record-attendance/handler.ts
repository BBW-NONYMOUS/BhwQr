// record-attendance (core flow 4). Validation order is fixed by decisions §D:
//  1 auth → 2 rate limit → 3 body → 4 active → 5 device → 6 signature → 7 expiry → 8 nonce known →
//  9 nonce reuse → 10 station → 11 GPS accuracy → 12 geofence → 13 cooldown → 14 day completed →
//  15 selfie. Steps 1-3 and the pure token checks (6-7) run here; the results of 6-7 are passed to
//  the record_scan SQL function, which evaluates 4..15 in order inside one transaction.
import { fail, json, readJson } from "../_shared/http.ts";
import { type KioskTokenPayload, KIOSK_QR_PREFIX, scanRequestSchema } from "../_shared/schemas.ts";
import type { VerifyResult } from "../_shared/hmac.ts";

/** Clock skew tolerated for iat (decisions §D step 7). */
export const IAT_SKEW_MS = 5_000;
export const RATE_LIMIT_PER_MINUTE = 10;

export interface ScanDeps {
  now(): number;
  getCallerId(req: Request): Promise<string | null>;
  /** Successful + failed attempts of this user in the last 60 s (database-backed). */
  countRecentAttempts(userId: string): Promise<number>;
  logAttempt(entry: {
    employeeId: string | null;
    stationId: string | null;
    code: string;
    nonce: string | null;
    lat?: number;
    lng?: number;
    accuracy?: number;
  }): Promise<void>;
  hashDevice(rawId: string): Promise<string>;
  verify(token: string): Promise<VerifyResult<KioskTokenPayload>>;
  recordScan(args: {
    employeeId: string;
    deviceHash: string;
    stationId: string;
    nonce: string;
    tokenValid: boolean;
    tokenExpired: boolean;
    lat: number;
    lng: number;
    accuracy: number;
    selfiePath: string | null;
  }): Promise<{ ok: boolean; code?: string; params?: Record<string, string | number>; [k: string]: unknown }>;
  reportAnomaly(employeeId: string, code: string, isMocked: boolean): Promise<void>;
  logError(message: string, context: Record<string, unknown>): Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPayload(p: KioskTokenPayload): boolean {
  return p?.v === 1 && UUID_RE.test(p.sid ?? "") && UUID_RE.test(p.n ?? "") &&
    Number.isFinite(p.iat) && Number.isFinite(p.exp) && p.exp > p.iat;
}

export async function handleScan(req: Request, deps: ScanDeps): Promise<Response> {
  try {
    // Step 1: authentication
    const userId = await deps.getCallerId(req);
    if (!userId) {
      await deps.logAttempt({ employeeId: null, stationId: null, code: "AUTH_REQUIRED", nonce: null });
      return fail(req, "AUTH_REQUIRED");
    }

    // The I/O for steps 2, 6 and 5 (rate-limit count, signature check, device hash) runs
    // concurrently to save round trips; the DECISIONS below are still taken in the fixed order.
    const parsed = scanRequestSchema.safeParse(await readJson(req));
    const [recentAttempts, verified, deviceHash] = await Promise.all([
      deps.countRecentAttempts(userId),
      parsed.success ? deps.verify(parsed.data.token) : Promise.resolve(null),
      parsed.success ? deps.hashDevice(parsed.data.deviceId) : Promise.resolve(""),
    ]);

    // Step 2: rate limit (10 / minute / user)
    if (recentAttempts >= RATE_LIMIT_PER_MINUTE) {
      await deps.logAttempt({ employeeId: userId, stationId: null, code: "RATE_LIMITED", nonce: null });
      return fail(req, "RATE_LIMITED");
    }

    // Step 3: request body
    if (!parsed.success) {
      await deps.logAttempt({ employeeId: userId, stationId: null, code: "INVALID_REQUEST", nonce: null });
      return fail(req, "INVALID_REQUEST");
    }
    const body = parsed.data;

    // Steps 6-7 are computed now and evaluated in order inside record_scan.
    const payload = verified?.ok && isValidPayload(verified.payload) ? verified.payload : null;
    const now = deps.now();
    const tokenExpired = payload ? now > payload.exp || payload.iat > now + IAT_SKEW_MS : false;

    const result = await deps.recordScan({
      employeeId: userId,
      deviceHash,
      stationId: payload?.sid ?? "00000000-0000-0000-0000-000000000000",
      nonce: payload?.n ?? "00000000-0000-0000-0000-000000000000",
      tokenValid: payload !== null,
      tokenExpired,
      lat: body.lat,
      lng: body.lng,
      accuracy: body.accuracy,
      selfiePath: body.selfiePath ?? null,
    });

    if (!result.ok) {
      await deps.reportAnomaly(userId, result.code ?? "INTERNAL_ERROR", body.isMocked === true);
      return fail(req, result.code ?? "INTERNAL_ERROR", result.params ?? {});
    }
    if (body.isMocked) await deps.reportAnomaly(userId, "MOCK_LOCATION", true);

    const action = result.action === "time_out" ? "Time-out" : "Time-in";
    return json(req, {
      ...result,
      message: `${action} recorded at ${result.time} – ${String(result.status).replace("_", " ")}.`,
    });
  } catch (e) {
    await deps.logError("record-attendance failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
}

export { KIOSK_QR_PREFIX };
