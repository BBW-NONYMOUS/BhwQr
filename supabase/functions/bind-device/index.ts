// bind-device (core flow 2): first mobile login binds the phone. Only active employees; one
// active device per employee; a second phone is blocked until the admin resets (D-05..D-07).
import { preflight } from "../_shared/cors.ts";
import { fail, failFromDb, json, readJson } from "../_shared/http.ts";
import { hashDeviceId } from "../_shared/hmac.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { bindDeviceRequestSchema } from "../_shared/schemas.ts";
import { adminClient, getCaller, logError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const user = await getCaller(req);
    if (!user) return fail(req, "AUTH_REQUIRED");
    if (!rateLimit(`bind:${user.id}`, 10, 60_000)) return fail(req, "RATE_LIMITED");

    const parsed = bindDeviceRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(req, "INVALID_REQUEST");

    const { data, error } = await adminClient().rpc("bind_device", {
      p_employee_id: user.id,
      p_device_hash: await hashDeviceId(parsed.data.deviceId),
      p_platform: parsed.data.platform,
      p_model: parsed.data.model,
    });
    if (error) return failFromDb(req, error);
    if (!data.ok) return fail(req, data.code, data.status ? { status: data.status } : {});
    return json(req, data);
  } catch (e) {
    await logError("bind-device failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
});
