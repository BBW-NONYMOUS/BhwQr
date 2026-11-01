import { bhwIdNumber, fullName, isoDate, reason, type ProfileStatus, type UserRole } from "@bhw/types";
import { z } from "zod";

// Pure helpers and form schemas shared by the Employees / Pending Approvals pages, their client
// dialogs and their Server Actions (one source of validation for both sides).

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  pending: "Pending",
  active: "Active",
  rejected: "Rejected",
  inactive: "Inactive",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  employee: "BHW employee",
  kiosk: "Kiosk / QR station",
  viewer: "Viewer (management)",
};

export const STAFF_ROLES = ["admin", "kiosk", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StatusAction = "approve" | "reject" | "deactivate" | "reactivate";

/**
 * Status actions the admin may take on a profile, following the account status state table
 * (business rules §2.1). The SQL RPCs enforce the same table; this only decides which buttons
 * to show. Admins never see "Deactivate" on their own account.
 */
export function availableStatusActions(
  profile: { role: UserRole; status: ProfileStatus },
  options: { isSelf?: boolean } = {},
): StatusAction[] {
  switch (profile.status) {
    case "pending":
      return profile.role === "employee" ? ["approve", "reject"] : [];
    case "active":
      return options.isSelf ? [] : ["deactivate"];
    case "inactive":
      return ["reactivate"];
    case "rejected":
      return [];
  }
}

/** Schedules can be (re)assigned to approved employees only; pending ones get one on approval. */
export function canAssignSchedule(profile: { role: UserRole; status: ProfileStatus }): boolean {
  return profile.role === "employee" && (profile.status === "active" || profile.status === "inactive");
}

/** A device can be reset only when the employee has an active (non-revoked) binding. */
export function canResetDevice(profile: { role: UserRole }, hasActiveDevice: boolean): boolean {
  return profile.role === "employee" && hasActiveDevice;
}

/** "Maria dela Cruz" -> "MC"; "Ana" -> "A"; blank -> "?". */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** Adds `days` (may be negative) to a YYYY-MM-DD date without any timezone shift. */
export function shiftIsoDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export type AssignmentState = "current" | "upcoming" | "ended";

/** Where a schedule assignment sits relative to `today` (all YYYY-MM-DD, Manila dates). */
export function assignmentState(
  assignment: { effective_from: string; effective_to: string | null },
  today: string,
): AssignmentState {
  if (assignment.effective_from > today) return "upcoming";
  if (assignment.effective_to !== null && assignment.effective_to < today) return "ended";
  return "current";
}

const ISO_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** [1,2,3,4,5] -> "Mon–Fri"; [1,3,5] -> "Mon, Wed, Fri" (ISO weekdays, 1 = Monday). */
export function formatWorkDays(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return "—";
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous && sorted.length >= 3) {
    return `${ISO_WEEKDAYS[sorted[0]! - 1]}–${ISO_WEEKDAYS[sorted[sorted.length - 1]! - 1]}`;
  }
  return sorted.map((d) => ISO_WEEKDAYS[d - 1]).join(", ");
}

/** "08:00:00" -> "08:00". */
export function formatClock(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "—";
}

export interface EmployeeFilter {
  status: ProfileStatus | "all";
  area: string | "all";
}

/** Toolbar filter for the employees table (FR-11). */
export function filterEmployees<T extends { status: ProfileStatus; area: string | null }>(
  rows: readonly T[],
  filter: EmployeeFilter,
): T[] {
  return rows.filter(
    (r) =>
      (filter.status === "all" || r.status === filter.status) &&
      (filter.area === "all" || (r.area ?? "") === filter.area),
  );
}

/** Distinct, non-empty areas sorted alphabetically (case-insensitive). */
export function uniqueAreas(rows: readonly { area: string | null }[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.area && r.area.trim()) set.add(r.area.trim());
  return [...set].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function isProfileStatus(value: string | undefined): value is ProfileStatus {
  return value === "pending" || value === "active" || value === "rejected" || value === "inactive";
}

// ---------------------------------------------------------------------------
// Form schemas (client dialogs + Server Actions)
// ---------------------------------------------------------------------------

export const reasonFormSchema = z.object({ reason });
export type ReasonFormInput = z.input<typeof reasonFormSchema>;

export const editEmployeeSchema = z.object({
  fullName,
  bhwIdNumber,
  area: z.string().trim().min(1, "Purok/area is required").max(80, "Area must be at most 80 characters"),
});
export type EditEmployeeInput = z.input<typeof editEmployeeSchema>;

export const editStaffSchema = z.object({ fullName });
export type EditStaffInput = z.input<typeof editStaffSchema>;

export const staffAccountSchema = z.object({
  fullName,
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  role: z.enum(STAFF_ROLES, { error: "Choose a role" }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});
export type StaffAccountInput = z.input<typeof staffAccountSchema>;

export const scheduleAssignmentSchema = z.object({
  scheduleId: z.guid({ error: "Choose a schedule" }),
  effectiveFrom: isoDate,
});
export type ScheduleAssignmentInput = z.input<typeof scheduleAssignmentSchema>;
