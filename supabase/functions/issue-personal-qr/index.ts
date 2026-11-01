// issue-personal-qr (core flow 5, FR-62): rotating personal QR for the admin fallback scan.
// Only an active employee on their bound phone. Valid 30 s, refreshed by the app every 15 s.
import { preflight } from "../_shared/cors.ts";
import { fail, failFromDb, json, readJson } from "../_shared/http.ts";
import { hashDeviceId, requireSecret, signToken } from "../_shared/hmac.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { PERSONAL_QR_PREFIX, personalQrRequestSchema } from "../_shared/schemas.ts";
import { adminClient, getCaller, logError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const user = await getCaller(req);
    if (!user) return fail(req, "AUTH_REQUIRED");
    if (!rateLimit(`pqr:${user.id}`, 12, 60_000)) return fail(req, "RATE_LIMITED");

    const parsed = personalQrRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(req, "INVALID_REQUEST");

    const db = adminClient();
    const { data: code, error } = await db.rpc("check_device", {
      p_employee_id: user.id,
      p_device_hash: await hashDeviceId(parsed.data.deviceId),
    });
    if (error) return failFromDb(req, error);
    if (code) return fail(req, code);

    const { data: settings } = await db
      .from("app_settings")
      .select("token_lifetime_seconds, token_refresh_seconds")
      .eq("id", 1)
      .single();
    const now = Date.now();
    const exp = now + (settings?.token_lifetime_seconds ?? 30) * 1000;
    const content = await signToken(
      PERSONAL_QR_PREFIX,
      { v: 1, eid: user.id, n: crypto.randomUUID(), iat: now, exp },
      requireSecret("PERSONAL_QR_SIGNING_SECRET"),
    );
    return json(req, {
      ok: true,
      content,
      expiresAt: exp,
      serverNow: now,
      refreshSeconds: settings?.token_refresh_seconds ?? 15,
    });
  } catch (e) {
    await logError("issue-personal-qr failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
});
