// log-error (core flow 9, FR-120): kiosk, mobile and web report errors into error_logs.
// Signed-in callers only (the kiosk and apps always have a session); rate limited per user.
import { preflight } from "../_shared/cors.ts";
import { fail, json, readJson } from "../_shared/http.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { logErrorRequestSchema } from "../_shared/schemas.ts";
import { adminClient, getCaller } from "../_shared/supabase.ts";

const MAX_CONTEXT_BYTES = 8_000;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const user = await getCaller(req);
  if (!user) return fail(req, "AUTH_REQUIRED");
  if (!rateLimit(`log:${user.id}`, 30, 60_000)) return fail(req, "RATE_LIMITED");

  const parsed = logErrorRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(req, "INVALID_REQUEST");

  let context = parsed.data.context ?? {};
  if (JSON.stringify(context).length > MAX_CONTEXT_BYTES) {
    context = { truncated: true, keys: Object.keys(context).slice(0, 50) };
  }
  const { error } = await adminClient().from("error_logs").insert({
    source: parsed.data.source,
    severity: parsed.data.severity,
    message: parsed.data.message,
    context: { ...context, user_agent: req.headers.get("user-agent")?.slice(0, 200) },
    user_id: user.id,
  });
  if (error) {
    console.error("log-error insert failed", error);
    return fail(req, "INTERNAL_ERROR");
  }
  return json(req, { ok: true });
});
