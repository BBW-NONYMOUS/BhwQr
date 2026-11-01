import { errorMessage, isErrorCode } from "@bhw/types";

/**
 * Result shape of every Server Action. Actions never throw for business errors; the client shows
 * `message` in a toast or next to the form field.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(code: string, params: Record<string, string | number> = {}): ActionResult<never> {
  return { ok: false, code, message: errorMessage(code, "en", params) };
}

/**
 * Maps a Supabase/PostgREST error to a catalog code. SQL functions raise the code itself as the
 * exception message (e.g. "REASON_REQUIRED"); permission errors map to FORBIDDEN.
 */
export function fromDbError(error: { message?: string; code?: string } | null): ActionResult<never> {
  const message = error?.message?.trim() ?? "";
  if (isErrorCode(message)) return fail(message);
  if (error?.code === "42501") return fail("FORBIDDEN");
  if (error?.code === "23505") return fail("INVALID_REQUEST");
  return fail("INTERNAL_ERROR");
}
