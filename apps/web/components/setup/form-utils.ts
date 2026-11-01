import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ActionResult } from "@/lib/actions";

/** Shows server-side field errors (zod or constraint mapping) next to the matching inputs. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  result: ActionResult<unknown>,
  fields: readonly Path<T>[],
): void {
  if (result.ok || !result.fieldErrors) return;
  for (const [key, message] of Object.entries(result.fieldErrors)) {
    const path = fields.find((f) => f === key || key.startsWith(`${f}.`));
    if (path) setError(path, { type: "server", message }, { shouldFocus: true });
  }
}

/** Value for a controlled `<input type="number">`: NaN/null render as an empty box. */
export function numberInputValue(value: number | null | undefined): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}
