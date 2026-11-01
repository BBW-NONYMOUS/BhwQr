"use server";

import { errorMessage, reviewCorrectionSchema } from "@bhw/types";
import { revalidatePath } from "next/cache";

import { zodFieldErrors } from "@/components/attendance/schemas";
import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Approves or rejects a correction request (FR-74, BR-68..BR-71). The SQL function updates the
 * attendance record in the same transaction, writes the in-app notification and the audit
 * entry; this action then e-mails the employee when e-mail is configured (FR-76, D-33).
 */
export async function reviewCorrectionAction(
  input: unknown,
): Promise<ActionResult<{ decision: "approved" | "rejected"; emailSent: boolean }>> {
  const admin = await currentProfileWithRole(["admin"]);
  if (!admin) return fail("FORBIDDEN");

  const parsed = reviewCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: errorMessage("INVALID_REQUEST", "en"),
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  const { requestId, decision } = parsed.data;
  const remarks = parsed.data.remarks?.trim() || undefined;

  const supabase = await createClient();
  const { data: request, error: findError } = await supabase
    .from("correction_requests")
    .select("id, employee_id")
    .eq("id", requestId)
    .maybeSingle();
  if (findError) return fromDbError(findError);
  if (!request) return fail("NOT_FOUND");

  const { error } = await supabase.rpc("review_correction_request", {
    p_request_id: requestId,
    p_decision: decision,
    ...(remarks ? { p_remarks: remarks } : {}),
  });
  if (error) return fromDbError(error);

  revalidatePath("/admin/corrections");
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");

  // E-mail is best effort: the decision is already saved and the in-app notification written.
  let emailSent = false;
  try {
    const { data: mail, error: mailError } = await supabase.functions.invoke<{ ok: boolean; sent?: boolean }>(
      "send-notification-email",
      {
        body: {
          userId: request.employee_id,
          kind: decision === "approved" ? "correction_approved" : "correction_rejected",
          ...(remarks ? { detail: remarks } : {}),
        },
      },
    );
    if (mailError) console.error("send-notification-email failed", mailError);
    emailSent = Boolean(mail?.ok && mail.sent !== false);
  } catch (e) {
    console.error("send-notification-email failed", e);
  }

  const verb = decision === "approved" ? "approved. The attendance record and DTR were updated" : "rejected";
  return ok(
    { decision, emailSent },
    `Request ${verb}. The employee was notified${emailSent ? " in the app and by e-mail" : " in the app"}.`,
  );
}
