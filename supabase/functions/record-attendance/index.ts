import { preflight } from "../_shared/cors.ts";
import { hashDeviceId, secretsWithPrevious, verifyToken } from "../_shared/hmac.ts";
import { KIOSK_QR_PREFIX, type KioskTokenPayload } from "../_shared/schemas.ts";
import { adminClient, getCallerId, logError } from "../_shared/supabase.ts";
import { handleScan } from "./handler.ts";

const db = adminClient();

// Supabase Edge Runtime: keeps the isolate alive for background work after the response is sent.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** Runs non-essential work after responding, so the employee never waits for it. */
function inBackground(work: () => Promise<void>): Promise<void> {
  const promise = work().catch((e) => console.error("background task failed", e));
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(promise);
    return Promise.resolve();
  }
  return promise;
}

Deno.serve((req) =>
  preflight(req) ??
    handleScan(req, {
      now: () => Date.now(),
      getCallerId,
      countRecentAttempts: async (userId) => {
        const { count } = await db
          .from("scan_attempts")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", userId)
          .gte("created_at", new Date(Date.now() - 60_000).toISOString());
        return count ?? 0;
      },
      logAttempt: async (e) => {
        await db.rpc("log_scan_attempt", {
          p_employee_id: e.employeeId,
          p_station_id: e.stationId,
          p_code: e.code,
          p_reason: null,
          p_lat: e.lat ?? null,
          p_lng: e.lng ?? null,
          p_accuracy: e.accuracy ?? null,
          p_device_hash: null,
          p_nonce: e.nonce,
          p_selfie_path: null,
        });
      },
      hashDevice: hashDeviceId,
      verify: (token) =>
        verifyToken<KioskTokenPayload>(KIOSK_QR_PREFIX, token, secretsWithPrevious("QR_SIGNING_SECRET")),
      recordScan: async (a) => {
        const { data, error } = await db.rpc("record_scan", {
          p_employee_id: a.employeeId,
          p_device_hash: a.deviceHash,
          p_station_id: a.stationId,
          p_nonce: a.nonce,
          p_token_valid: a.tokenValid,
          p_token_expired: a.tokenExpired,
          p_lat: a.lat,
          p_lng: a.lng,
          p_accuracy: a.accuracy,
          p_selfie_path: a.selfiePath,
        });
        if (error) throw new Error(error.message);
        return data;
      },
      reportAnomaly: (employeeId, code, isMocked) => inBackground(async () => {
        // Anomaly flags (FR-58): >= 5 failures in 10 min, repeated geofence/reuse failures, or a
        // mocked location. One flag per employee per 10 minutes.
        const since = new Date(Date.now() - 10 * 60_000).toISOString();
        const { data: recent } = await db
          .from("scan_attempts")
          .select("error_code")
          .eq("employee_id", employeeId)
          .eq("success", false)
          .gte("created_at", since);
        const failures = recent ?? [];
        const repeated = failures.filter((f) =>
          f.error_code === "OUTSIDE_GEOFENCE" || f.error_code === "QR_REUSED"
        ).length >= 3;
        if (!(isMocked || failures.length >= 5 || repeated)) return;
        const { count } = await db
          .from("error_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", employeeId)
          .eq("context->>kind", "scan_anomaly")
          .gte("created_at", since);
        if ((count ?? 0) > 0) return;
        await logError("Suspicious scan activity", {
          kind: "scan_anomaly",
          last_code: code,
          failures_10min: failures.length,
          mocked_location: isMocked,
        }, "warning", employeeId);
      }),
      logError: (message, context) => logError(message, context, "error"),
    })
);
