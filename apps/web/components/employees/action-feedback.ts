import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions";

/**
 * Shows the outcome of a Server Action as Sonner toasts (design spec "Feedback"). A `note` in
 * the result data (e.g. "No e-mail was sent") is shown as a second, neutral toast.
 * Returns true when the action succeeded.
 */
export function showActionResult<T>(result: ActionResult<T>, fallbackSuccess = "Saved."): boolean {
  if (!result.ok) {
    toast.error(result.message);
    return false;
  }
  toast.success(result.message ?? fallbackSuccess);
  const data = result.data as { note?: unknown } | undefined;
  if (data && typeof data.note === "string" && data.note) {
    toast.message("E-mail notice", { description: data.note });
  }
  return true;
}
