// record-fallback-scan (core flow 5, FR-63): the admin scans an employee's personal QR on the web.
// Records method = 'fallback_personal_qr' with the same time-in/out and status rules.
import { preflight } from "../_shared/cors.ts";
import { fail, failFromDb, json, readJson } from "../_shared/http.ts";
import { secretsWithPrevious, verifyToken } from "../_shared/hmac.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import {
  fallbackScanRequestSchema,
  PERSONAL_QR_PREFIX,
  type PersonalTokenPayload,
} from "../_shared/schemas.ts";
import { adminClient, getCaller, getProfile, logError } from "../_shared/supabase.ts";

const UUID_RE = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const user = await getCaller(req);
    if (!user) return fail(req, "AUTH_REQUIRED");
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== "admin" || profile.status !== "active") {
      return fail(req, "FORBIDDEN");
    }
    if (!rateLimit(`fallback:${user.id}`, 30, 60_000)) return fail(req, "RATE_LIMITED");

    const parsed = fallbackScanRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(req, "INVALID_REQUEST");

    const verified = await verifyToken<PersonalTokenPayload>(
      PERSONAL_QR_PREFIX,
      parsed.data.token,
      secretsWithPrevious("PERSONAL_QR_SIGNING_SECRET"),
    );
    const payload = verified.ok && verified.payload.v === 1 && UUID_RE.test(verified.payload.eid) &&
        UUID_RE.test(verified.payload.n)
      ? verified.payload
      : null;
    const now = Date.now();

    const { data, error } = await adminClient().rpc("record_fallback_scan", {
      p_admin_id: user.id,
      p_employee_id: payload?.eid ?? "00000000-0000-0000-0000-000000000000",
      p_station_id: parsed.data.stationId,
      p_nonce: payload?.n ?? "00000000-0000-0000-0000-000000000000",
      p_token_valid: payload !== null,
      p_token_expired: payload ? now > payload.exp || payload.iat > now + 5_000 : false,
    });
    if (error) return failFromDb(req, error);
    if (!data.ok) return fail(req, data.code, data.params ?? {});
    const action = data.action === "time_out" ? "Time-out" : "Time-in";
    return json(req, {
      ...data,
      message: `${action} recorded for ${data.employeeName} at ${data.time} (fallback).`,
    });
  } catch (e) {
    await logError("record-fallback-scan failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
});
