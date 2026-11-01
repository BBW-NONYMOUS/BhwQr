import { fromDbError, type ActionResult } from "@/lib/actions";

export interface DbError {
  message?: string;
  code?: string;
  details?: string | null;
}

export interface ConstraintMessage {
  /** Substring of the constraint/column name found in the Postgres message or details. */
  match: string;
  /** Form field the message belongs to (shown inline). */
  field: string;
  message: string;
}

/**
 * Maps unique (23505) and check (23514) violations to an inline field error, so the admin sees
 * which value to change. Everything else goes through the shared catalog mapping (fromDbError),
 * which already handles codes raised by SQL functions such as SCHEDULE_IN_USE.
 */
export function mapConstraintError(error: DbError | null, messages: readonly ConstraintMessage[]): ActionResult<never> {
  if (error && (error.code === "23505" || error.code === "23514")) {
    const haystack = `${error.message ?? ""} ${error.details ?? ""}`;
    const hit = messages.find((m) => haystack.includes(m.match));
    if (hit) {
      return { ok: false, code: "INVALID_REQUEST", message: hit.message, fieldErrors: { [hit.field]: hit.message } };
    }
  }
  return fromDbError(error);
}

/** Turns zod issues into the `fieldErrors` map used by ActionResult. */
export function zodFieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Validation failure result with field errors (message = first issue). */
export function invalid(issues: readonly { path: readonly PropertyKey[]; message: string }[]): ActionResult<never> {
  return {
    ok: false,
    code: "INVALID_REQUEST",
    message: issues[0]?.message ?? "Please check the form and try again.",
    fieldErrors: zodFieldErrors(issues),
  };
}
