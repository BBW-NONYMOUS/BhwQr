// Postgres enums (docs/phase-1-system-analysis/09-data-dictionary.md section 3).
// Keep in sync with supabase/migrations/*_enums.sql; the pgTAP test enum_values.test.sql checks both.

export const USER_ROLES = ["admin", "employee", "kiosk", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFILE_STATUSES = ["pending", "active", "rejected", "inactive"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  "on_time",
  "late",
  "absent",
  "undertime",
  "incomplete",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_METHODS = ["qr", "fallback_personal_qr", "manual", "correction"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const CORRECTION_TYPES = [
  "missing_time_in",
  "missing_time_out",
  "wrong_time",
  "official_business",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const CORRECTION_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const ERROR_SOURCES = ["edge_function", "kiosk", "mobile", "web"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];

export const ERROR_SEVERITIES = ["info", "warning", "error", "critical"] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];

export const DEVICE_PLATFORMS = ["android", "ios"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const NOTIFICATION_KINDS = [
  "registration_approved",
  "registration_rejected",
  "correction_approved",
  "correction_rejected",
  "device_reset",
  "record_incomplete",
  "new_registration",
  "new_correction_request",
  "kiosk_offline",
  "periodic_verification",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const CORRECTION_TYPE_LABELS: Record<CorrectionType, { en: string; fil: string }> = {
  missing_time_in: { en: "Missing time-in", fil: "Walang time-in" },
  missing_time_out: { en: "Missing time-out", fil: "Walang time-out" },
  wrong_time: { en: "Wrong time", fil: "Maling oras" },
  official_business: { en: "Official business / field work", fil: "Opisyal na lakad / field work" },
};

export const METHOD_LABELS: Record<AttendanceMethod, string> = {
  qr: "Kiosk QR",
  fallback_personal_qr: "Fallback (personal QR)",
  manual: "Manual entry",
  correction: "Approved correction",
};

/** Timezone for every attendance computation and display (BR-01). */
export const APP_TIMEZONE = "Asia/Manila";
