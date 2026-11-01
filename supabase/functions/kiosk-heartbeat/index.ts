// kiosk-heartbeat (core flow 8, FR-109, FR-119): every 60 s. Stores app version, clock drift and
// last token time, and marks the station online. Offline detection is the pg_cron job.
import { preflight } from "../_shared/cors.ts";
import { fail, failFromDb, json, readJson } from "../_shared/http.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { heartbeatRequestSchema } from "../_shared/schemas.ts";
import { adminClient, getCaller, getProfile, logError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const user = await getCaller(req);
    if (!user) return fail(req, "AUTH_REQUIRED");
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== "kiosk" || profile.status !== "active") {
      return fail(req, "FORBIDDEN");
    }
    if (!rateLimit(`hb:${user.id}`, 10, 60_000)) return fail(req, "RATE_LIMITED");

    const parsed = heartbeatRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(req, "INVALID_REQUEST");

    const { data, error } = await adminClient().rpc("record_heartbeat", {
      p_kiosk_user: user.id,
      p_station_id: parsed.data.stationId,
      p_app_version: parsed.data.appVersion,
      p_client_now_ms: Math.round(parsed.data.clientNow),
      p_last_token_at_ms: parsed.data.lastTokenAt === null ? null : Math.round(parsed.data.lastTokenAt),
    });
    if (error) return failFromDb(req, error);
    if (!data.ok) return fail(req, data.code);

    if (data.driftWarning) {
      await logError("Kiosk clock drift above 30 s", {
        station_id: parsed.data.stationId,
        clock_drift_ms: data.clockDriftMs,
      }, "warning", user.id);
    }
    return json(req, data);
  } catch (e) {
    await logError("kiosk-heartbeat failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
});
