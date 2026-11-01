import { FunctionsHttpError } from "@supabase/supabase-js";

import { getSupabase } from "./supabase";

export type ApiError = { ok: false; code: string; message: string; params?: Record<string, string | number> };
export type ApiResult<T> = ({ ok: true } & T) | ApiError;

/**
 * Calls an Edge Function and always resolves to `{ ok: true, ... }` or `{ ok: false, code }`.
 * Network failures become OFFLINE so the UI can show the offline message (never a raw error).
 */
export async function callFunction<T extends object>(
  name: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  try {
    const { data, error } = await getSupabase().functions.invoke(name, { body });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const payload = (await error.context.json().catch(() => null)) as ApiError | null;
        if (payload && typeof payload.code === "string") return { ...payload, ok: false };
        return { ok: false, code: "INTERNAL_ERROR", message: error.message };
      }
      return { ok: false, code: "OFFLINE", message: error.message };
    }
    return data as ApiResult<T>;
  } catch (e) {
    return { ok: false, code: "OFFLINE", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Reports an unexpected app error to Admin → Error Logs (core flow 9). Never throws. */
export async function reportError(
  message: string,
  context: Record<string, unknown> = {},
  severity: "info" | "warning" | "error" | "critical" = "error",
): Promise<void> {
  try {
    await getSupabase().functions.invoke("log-error", {
      body: { source: "mobile", severity, message: message.slice(0, 1000), context },
    });
  } catch {
    // Logging must never break the app.
  }
}
