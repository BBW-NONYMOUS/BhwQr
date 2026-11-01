// device-sync (FR-116, FR-117): contract for a future fingerprint terminal. See README.md here.
// Auth: header `x-api-key: <DEVICE_SYNC_API_KEY>` (terminal has no user session).
// Each event is processed at most once per (employee, eventId). No schema changes are needed:
// the terminal is a stations row, events become scan_attempts + attendance_records.
import { preflight } from "../_shared/cors.ts";
import { fail, json, readJson } from "../_shared/http.ts";
import { hmacHex } from "../_shared/hmac.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { deviceSyncRequestSchema } from "../_shared/schemas.ts";
import { adminClient, logError } from "../_shared/supabase.ts";

async function sameSecret(a: string, b: string): Promise<boolean> {
  // Compare HMACs so the comparison time does not depend on where the strings differ.
  const key = crypto.randomUUID();
  return (await hmacHex(key, a)) === (await hmacHex(key, b));
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const expected = Deno.env.get("DEVICE_SYNC_API_KEY") ?? "";
  const provided = req.headers.get("x-api-key") ?? "";
  if (!expected || !provided || !(await sameSecret(expected, provided))) {
    return fail(req, "AUTH_REQUIRED");
  }
  if (!rateLimit(`sync:${provided.slice(0, 8)}`, 60, 60_000)) return fail(req, "RATE_LIMITED");

  const parsed = deviceSyncRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(req, "INVALID_REQUEST");

  const db = adminClient();
  const results = [];
  for (const ev of [...parsed.data.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const { data, error } = await db.rpc("record_device_sync_event", {
      p_station_id: parsed.data.stationId,
      p_bhw_id_number: ev.bhwIdNumber,
      p_event_id: ev.eventId,
      p_occurred_at: ev.occurredAt,
    });
    if (error) {
      await logError("device-sync event failed", {
        terminal: parsed.data.terminalSerial,
        event_id: ev.eventId,
        error: error.message,
      });
      results.push({ eventId: ev.eventId, status: "rejected", code: "INTERNAL_ERROR" });
      continue;
    }
    results.push({ eventId: ev.eventId, ...data });
  }
  return json(req, { ok: true, results });
});
