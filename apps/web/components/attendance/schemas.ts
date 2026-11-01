import { isoDate, manualEntrySchema } from "@bhw/types";
import { z } from "zod";

// Form schemas used by both the client dialogs (zodResolver) and the Server Actions, so the
// same rules run in the browser and on the server.

/** Manual entry (FR-65) plus the optional station the admin picks. */
export const manualEntryFormSchema = z.intersection(
  manualEntrySchema,
  z.object({ stationId: z.uuid("Choose a station").nullable() }),
);
export type ManualEntryFormInput = z.input<typeof manualEntryFormSchema>;
export type ManualEntryForm = z.output<typeof manualEntryFormSchema>;

/** Recompute statuses for a date range (FR-106), optionally for one employee. */
export const recomputeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    employeeId: z.uuid().nullable(),
  })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "The end date must be on or after the start date" });
export type RecomputeInput = z.infer<typeof recomputeSchema>;

/** Flattens zod issues to { field: first message } for ActionResult.fieldErrors. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "root";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
