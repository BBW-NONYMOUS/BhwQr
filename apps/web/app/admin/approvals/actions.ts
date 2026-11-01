"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { reasonFormSchema, scheduleAssignmentSchema } from "@/components/employees/employee-helpers";
import { emailNote, sendNotificationEmail } from "@/components/employees/server-helpers";
import { type ActionResult, fail, fromDbError, ok } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Pending Approvals (core flow 2, FR-21..FR-26). The RPCs set status, approved_by/at, the
// schedule row and the in-app notification in one transaction and are audited by triggers.

const employeeId = z.guid();

function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return {
    ok: false,
    code: "INVALID_REQUEST",
    message: error.issues[0]?.message ?? "Please check the form and try again.",
    fieldErrors,
  };
}

function revalidateApprovals(id: string) {
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${id}`);
  // Sidebar badge and dashboard count (FR-25) come from the admin layout.
  revalidatePath("/admin", "layout");
}

export async function approveRegistration(
  id: string,
  input: unknown,
): Promise<ActionResult<{ note?: string }>> {
  if (!(await currentProfileWithRole(["admin"]))) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");
  const parsed = scheduleAssignmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_employee", {
    p_employee_id: idParsed.data,
    p_schedule_id: parsed.data.scheduleId,
    p_effective_from: parsed.data.effectiveFrom,
  });
  if (error) return fromDbError(error);

  const outcome = await sendNotificationEmail(supabase, idParsed.data, "registration_approved");
  revalidateApprovals(idParsed.data);
  return ok({ note: emailNote(outcome) }, "Registration approved. The employee can now log in on the app.");
}

export async function rejectRegistration(
  id: string,
  input: unknown,
): Promise<ActionResult<{ note?: string }>> {
  if (!(await currentProfileWithRole(["admin"]))) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");
  const parsed = reasonFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_employee", {
    p_employee_id: idParsed.data,
    p_reason: parsed.data.reason,
  });
  if (error) return fromDbError(error);

  const outcome = await sendNotificationEmail(
    supabase,
    idParsed.data,
    "registration_rejected",
    `Reason: ${parsed.data.reason}`,
  );
  revalidateApprovals(idParsed.data);
  return ok({ note: emailNote(outcome) }, "Registration rejected. The reason was sent to the registrant.");
}
