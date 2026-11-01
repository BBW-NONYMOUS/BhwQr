"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  editEmployeeSchema,
  editStaffSchema,
  reasonFormSchema,
  scheduleAssignmentSchema,
  staffAccountSchema,
} from "@/components/employees/employee-helpers";
import { emailNote, sendNotificationEmail } from "@/components/employees/server-helpers";
import { type ActionResult, fail, fromDbError, ok } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Server Actions for /admin/employees and /admin/employees/[id]. Each one re-checks the admin
// role (BR-18) and calls the RPC with the admin's own JWT so assert_admin() and RLS apply.

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

function revalidateEmployee(id?: string) {
  revalidatePath("/admin/employees");
  if (id) revalidatePath(`/admin/employees/${id}`);
  // The admin layout shows sidebar counts from get_dashboard_today().
  revalidatePath("/admin", "layout");
}

async function requireAdmin() {
  return currentProfileWithRole(["admin"]);
}

// ---------------------------------------------------------------------------
// Profile edit (FR-13). Contact number and address stay employee-owned (FR-18).
// ---------------------------------------------------------------------------

export async function updateEmployeeProfile(
  id: string,
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!(await requireAdmin())) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");

  const supabase = await createClient();
  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (readError) return fromDbError(readError);
  if (!target) return fail("NOT_FOUND");

  let patch: { full_name: string; bhw_id_number?: string; area?: string };
  if (target.role === "employee") {
    const parsed = editEmployeeSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    patch = { full_name: parsed.data.fullName, bhw_id_number: parsed.data.bhwIdNumber, area: parsed.data.area };
  } else {
    const parsed = editStaffSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    patch = { full_name: parsed.data.fullName };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", target.id)
    .select("id");
  if (error) return error.code === "23505" ? fail("BHW_ID_TAKEN") : fromDbError(error);
  if (!updated || updated.length === 0) return fail("NOT_FOUND");

  revalidateEmployee(target.id);
  return ok(undefined, "Profile updated.");
}

// ---------------------------------------------------------------------------
// Status changes (FR-15, state table §2.1)
// ---------------------------------------------------------------------------

export async function deactivateEmployee(id: string, input: unknown): Promise<ActionResult<undefined>> {
  if (!(await requireAdmin())) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");
  const parsed = reasonFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_employee", {
    p_employee_id: idParsed.data,
    p_reason: parsed.data.reason,
  });
  if (error) return fromDbError(error);

  revalidateEmployee(idParsed.data);
  return ok(undefined, "Account deactivated. They can no longer scan or log in.");
}

export async function reactivateEmployee(id: string): Promise<ActionResult<undefined>> {
  if (!(await requireAdmin())) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_employee", { p_employee_id: idParsed.data });
  if (error) return fromDbError(error);

  revalidateEmployee(idParsed.data);
  return ok(undefined, "Account reactivated.");
}

// ---------------------------------------------------------------------------
// Device reset (FR-32, D-07)
// ---------------------------------------------------------------------------

export async function resetEmployeeDevice(
  id: string,
  input: unknown,
): Promise<ActionResult<{ note?: string }>> {
  if (!(await requireAdmin())) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");
  const parsed = reasonFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_device", {
    p_employee_id: idParsed.data,
    p_reason: parsed.data.reason,
  });
  if (error) return fromDbError(error);

  const outcome = await sendNotificationEmail(supabase, idParsed.data, "device_reset");
  revalidateEmployee(idParsed.data);
  return ok({ note: emailNote(outcome) }, "Device reset. The next phone they log in with will be registered.");
}

// ---------------------------------------------------------------------------
// Schedule assignment (FR-16, D-19)
// ---------------------------------------------------------------------------

export async function assignEmployeeSchedule(id: string, input: unknown): Promise<ActionResult<undefined>> {
  if (!(await requireAdmin())) return fail("FORBIDDEN");
  const idParsed = employeeId.safeParse(id);
  if (!idParsed.success) return fail("NOT_FOUND");
  const parsed = scheduleAssignmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_schedule", {
    p_employee_id: idParsed.data,
    p_schedule_id: parsed.data.scheduleId,
    p_effective_from: parsed.data.effectiveFrom,
  });
  if (error) return fromDbError(error);

  revalidateEmployee(idParsed.data);
  return ok(undefined, "Schedule assigned.");
}

// ---------------------------------------------------------------------------
// Staff accounts: admin / kiosk / viewer (FR-14, BR-05)
// ---------------------------------------------------------------------------

export async function createStaffAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdmin())) return fail("FORBIDDEN");
  const parsed = staffAccountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      code: "SERVICE_ROLE_MISSING",
      message:
        "Staff accounts can be created only when SUPABASE_SERVICE_ROLE_KEY is set in apps/web/.env.local. Restart the web server after adding it.",
    };
  }

  // handle_new_user() reads app_metadata.role and creates an active profile for staff roles.
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role: parsed.data.role },
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists") return fail("EMAIL_TAKEN");
    if (error?.code === "weak_password") {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "That password is too weak. Use a longer password with letters and numbers.",
        fieldErrors: { password: "Password is too weak" },
      };
    }
    return fail("INTERNAL_ERROR");
  }

  revalidateEmployee();
  return ok({ id: data.user.id }, `${parsed.data.fullName} can now log in with the temporary password.`);
}
