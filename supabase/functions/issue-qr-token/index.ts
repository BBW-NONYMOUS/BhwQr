// issue-qr-token (core flow 3): the kiosk calls this every token_refresh_seconds (15 s).
// Only the station's kiosk account (or an admin previewing the kiosk) may issue tokens.
import { preflight } from "../_shared/cors.ts";
import { fail, failFromDb, json, readJson } from "../_shared/http.ts";
import { requireSecret, signToken } from "../_shared/hmac.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { issueQrRequestSchema, KIOSK_QR_PREFIX } from "../_shared/schemas.ts";
import { adminClient, getCaller, getProfile, logError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const user = await getCaller(req);
    if (!user) return fail(req, "AUTH_REQUIRED");
    const profile = await getProfile(user.id);
    if (!profile || profile.status !== "active" || !["kiosk", "admin"].includes(profile.role)) {
      return fail(req, "FORBIDDEN");
    }
    if (!rateLimit(`qr:${user.id}`, 20, 60_000)) return fail(req, "RATE_LIMITED");

    const parsed = issueQrRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(req, "INVALID_REQUEST");

    const db = adminClient();
    const { data: settings } = await db
      .from("app_settings")
      .select("token_lifetime_seconds, token_refresh_seconds")
      .eq("id", 1)
      .single();
    const lifetime = settings?.token_lifetime_seconds ?? 30;
    const nonce = crypto.randomUUID();

    const { data, error } = await db.rpc("register_qr_nonce", {
      p_kiosk_user: user.id,
      p_station_id: parsed.data.stationId,
      p_nonce: nonce,
      p_lifetime_seconds: lifetime,
    });
    if (error) return failFromDb(req, error);
    if (!data.ok) return fail(req, data.code);

    const iat = new Date(data.issuedAt).getTime();
    const exp = new Date(data.expiresAt).getTime();
    const content = await signToken(
      KIOSK_QR_PREFIX,
      { v: 1, sid: parsed.data.stationId, n: nonce, iat, exp },
      requireSecret("QR_SIGNING_SECRET"),
    );

    return json(req, {
      ok: true,
      content,
      issuedAt: iat,
      expiresAt: exp,
      serverNow: Date.now(),
      refreshSeconds: settings?.token_refresh_seconds ?? 15,
      stationName: data.stationName,
    });
  } catch (e) {
    await logError("issue-qr-token failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
});
