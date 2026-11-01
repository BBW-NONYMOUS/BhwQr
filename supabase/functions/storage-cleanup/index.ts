// storage-cleanup (D-32): deletes storage files whose retention ended (selfies after 30 days,
// attachments after 5 years, photos of rejected registrations after 90 days) through the Storage
// API. Called daily by pg_cron with the service-role key; nothing else may call it.
import { fail, json } from "../_shared/http.ts";
import { adminClient, bearerToken, logError } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (bearerToken(req) !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return fail(req, "FORBIDDEN");
  const db = adminClient();
  const { data, error } = await db.rpc("storage_purge_candidates");
  if (error) {
    await logError("storage-cleanup: candidate query failed", { error: error.message }, "error");
    return fail(req, "INTERNAL_ERROR");
  }
  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row.name]);
  }
  const removed: Record<string, number> = {};
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const { data: gone, error: e } = await db.storage.from(bucket).remove(names.slice(i, i + 100));
      if (e) await logError("storage-cleanup: remove failed", { bucket, error: e.message }, "error");
      removed[bucket] = (removed[bucket] ?? 0) + (gone?.length ?? 0);
    }
  }
  return json(req, { ok: true, removed });
});
