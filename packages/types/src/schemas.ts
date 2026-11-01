import { z } from "zod";
import {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  CORRECTION_STATUSES,
  CORRECTION_TYPES,
  DEVICE_PLATFORMS,
  ERROR_SEVERITIES,
  ERROR_SOURCES,
} from "./enums.ts";
import { SCAN_ERROR_CODES } from "./errors.generated.ts";
import { KIOSK_QR_PREFIX, PERSONAL_QR_PREFIX } from "./qr.ts";

// ---------------------------------------------------------------------------
// Common field schemas (BR-06, BR-07, BR-09, BR-10)
// ---------------------------------------------------------------------------

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)");

/** Normalises "0917 123 4567" / "+639171234567" to "09171234567" (BR-10). */
export function normalizePhMobile(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+63")) return `0${digits.slice(3)}`;
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export const phMobile = z
  .string()
  .trim()
  .transform(normalizePhMobile)
  .pipe(z.string().regex(/^09\d{9}$/, "Enter a mobile number like 09171234567"));

export const fullName = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(100, "Full name must be at most 100 characters");

export const bhwIdNumber = z
  .string()
  .trim()
  .min(3, "BHW ID number must be at least 3 characters")
  .max(30, "BHW ID number must be at most 30 characters")
  .transform((v) => v.toUpperCase());

export const reason = z
  .string()
  .trim()
  .min(10, "Please enter a reason of at least 10 characters")
  .max(500, "Reason must be at most 500 characters");

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_MIME_TYPES = [...PHOTO_MIME_TYPES, "application/pdf"] as const;

// ---------------------------------------------------------------------------
// Registration (core flow 1, FR-01..FR-10)
// ---------------------------------------------------------------------------

export const registrationSchema = z
  .object({
    fullName,
    bhwIdNumber,
    area: z.string().trim().min(1, "Purok/area is required").max(80),
    contactNumber: phMobile,
    address: z.string().trim().max(200).optional().or(z.literal("")),
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string(),
    consent: z.literal(true, { error: "Please read and agree to the Data Privacy notice" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

export const photoFileSchema = z.object({
  size: z.number().max(PHOTO_MAX_BYTES, "Photos must be 5 MB or smaller"),
  type: z.enum(PHOTO_MIME_TYPES, { error: "Use a JPG, PNG or WebP image" }),
});

// ---------------------------------------------------------------------------
// Device binding
// ---------------------------------------------------------------------------

export const bindDeviceRequestSchema = z.object({
  deviceId: z.uuid(),
  platform: z.enum(DEVICE_PLATFORMS),
  model: z.string().trim().max(100).nullable(),
  appVersion: z.string().trim().max(20),
});
export type BindDeviceRequest = z.infer<typeof bindDeviceRequestSchema>;

// ---------------------------------------------------------------------------
// Scan attendance (core flow 4, decisions section D)
// ---------------------------------------------------------------------------

export const scanRequestSchema = z.object({
  /** Full QR content including the BHWQR1: prefix. */
  token: z.string().startsWith(KIOSK_QR_PREFIX).max(1024),
  deviceId: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** GPS accuracy radius in metres reported by expo-location. */
  accuracy: z.number().min(0).max(100000),
  /** Android mock-location flag from expo-location (anomaly signal, not a hard block). */
  isMocked: z.boolean().optional(),
  /** Storage path in the selfies bucket when app_settings.selfie_required = true. */
  selfiePath: z.string().max(200).optional(),
  appVersion: z.string().max(20).optional(),
});
export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const scanSuccessSchema = z.object({
  ok: z.literal(true),
  action: z.enum(["time_in", "time_out"]),
  workDate: isoDate,
  /** Server timestamp of the scan (ISO 8601). */
  recordedAt: z.string(),
  /** Manila HH:mm for display. */
  time: hhmm,
  status: z.enum(ATTENDANCE_STATUSES),
  minutesLate: z.number().int().min(0),
  undertimeMinutes: z.number().int().min(0),
  stationName: z.string(),
  employeeName: z.string(),
  message: z.string(),
});
export type ScanSuccess = z.infer<typeof scanSuccessSchema>;

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  /** English message, for logs. Clients translate from the catalog using `code`. */
  message: z.string(),
  /** Values for message placeholders: accuracy, max, distance, radius, last_time, next_time. */
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const scanResponseSchema = z.discriminatedUnion("ok", [
  scanSuccessSchema,
  errorResponseSchema.extend({ code: z.enum(SCAN_ERROR_CODES) }),
]);
export type ScanResponse = z.infer<typeof scanResponseSchema>;

// ---------------------------------------------------------------------------
// Kiosk
// ---------------------------------------------------------------------------

export const issueQrRequestSchema = z.object({ stationId: z.uuid() });
export const issueQrResponseSchema = z.object({
  ok: z.literal(true),
  content: z.string().startsWith(KIOSK_QR_PREFIX),
  issuedAt: z.number(),
  expiresAt: z.number(),
  serverNow: z.number(),
  refreshSeconds: z.number().int(),
  stationName: z.string(),
});
export type IssueQrResponse = z.infer<typeof issueQrResponseSchema>;

export const heartbeatRequestSchema = z.object({
  stationId: z.uuid(),
  appVersion: z.string().max(20),
  /** Kiosk Date.now() at send time; server computes drift = clientNow - serverNow. */
  clientNow: z.number(),
  lastTokenAt: z.number().nullable(),
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;

export const heartbeatResponseSchema = z.object({
  ok: z.literal(true),
  serverNow: z.number(),
  clockDriftMs: z.number(),
  driftWarning: z.boolean(),
});

// ---------------------------------------------------------------------------
// Fallback (core flow 5)
// ---------------------------------------------------------------------------

export const personalQrResponseSchema = z.object({
  ok: z.literal(true),
  content: z.string().startsWith(PERSONAL_QR_PREFIX),
  expiresAt: z.number(),
  serverNow: z.number(),
  refreshSeconds: z.number().int(),
});

export const fallbackScanRequestSchema = z.object({
  token: z.string().startsWith(PERSONAL_QR_PREFIX).max(1024),
  stationId: z.uuid(),
});

export const manualEntrySchema = z
  .object({
    employeeId: z.uuid(),
    workDate: isoDate,
    timeIn: hhmm.nullable(),
    timeOut: hhmm.nullable(),
    reason,
  })
  .refine((v) => v.timeIn !== null || v.timeOut !== null, {
    message: "Enter a time-in, a time-out, or both",
    path: ["timeIn"],
  })
  .refine((v) => !v.timeIn || !v.timeOut || v.timeOut > v.timeIn, {
    message: "Time-out must be later than time-in",
    path: ["timeOut"],
  });
export type ManualEntry = z.infer<typeof manualEntrySchema>;

// ---------------------------------------------------------------------------
// Attendance record (row shape returned by RPCs / selects)
// ---------------------------------------------------------------------------

export const attendanceRecordSchema = z.object({
  id: z.uuid(),
  employee_id: z.uuid(),
  work_date: isoDate,
  time_in: z.string().nullable(),
  time_out: z.string().nullable(),
  station_id: z.uuid().nullable(),
  status: z.enum(ATTENDANCE_STATUSES),
  minutes_late: z.number().int(),
  undertime_minutes: z.number().int(),
  method: z.enum(ATTENDANCE_METHODS),
  notes: z.string().nullable(),
});
export type AttendanceRecordRow = z.infer<typeof attendanceRecordSchema>;

// ---------------------------------------------------------------------------
// Correction requests (core flow 6)
// ---------------------------------------------------------------------------

export const correctionRequestSchema = z
  .object({
    workDate: isoDate,
    type: z.enum(CORRECTION_TYPES),
    requestedTimeIn: hhmm.nullable(),
    requestedTimeOut: hhmm.nullable(),
    reason,
    attachmentPath: z.string().max(300).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "missing_time_in" && !v.requestedTimeIn) {
      ctx.addIssue({ code: "custom", path: ["requestedTimeIn"], message: "Enter the time-in" });
    }
    if (v.type === "missing_time_out" && !v.requestedTimeOut) {
      ctx.addIssue({ code: "custom", path: ["requestedTimeOut"], message: "Enter the time-out" });
    }
    if (v.type === "wrong_time" && !v.requestedTimeIn && !v.requestedTimeOut) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedTimeIn"],
        message: "Enter the correct time-in, time-out, or both",
      });
    }
    if (v.requestedTimeIn && v.requestedTimeOut && v.requestedTimeOut <= v.requestedTimeIn) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedTimeOut"],
        message: "Time-out must be later than time-in",
      });
    }
  });
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;

export const reviewCorrectionSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
    remarks: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === "approved" || (v.remarks?.length ?? 0) >= 10, {
    path: ["remarks"],
    message: "Please enter remarks of at least 10 characters when rejecting",
  });

export const correctionStatusSchema = z.enum(CORRECTION_STATUSES);

// ---------------------------------------------------------------------------
// Reports and DTR
// ---------------------------------------------------------------------------

export const reportFiltersSchema = z.discriminatedUnion("period", [
  z.object({ period: z.literal("daily"), date: isoDate, area: z.string().optional() }),
  z.object({ period: z.literal("weekly"), weekStart: isoDate, area: z.string().optional() }),
  z.object({
    period: z.literal("monthly"),
    year: z.number().int().min(2024).max(2100),
    month: z.number().int().min(1).max(12),
    area: z.string().optional(),
  }),
]);
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const dtrRequestSchema = z.object({
  employeeId: z.uuid().optional(),
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
});

export const dtrRowSchema = z.object({
  day: z.number().int().min(1).max(31),
  am_arrival: z.string().nullable(),
  am_departure: z.string().nullable(),
  pm_arrival: z.string().nullable(),
  pm_departure: z.string().nullable(),
  undertime_hours: z.number().int(),
  undertime_minutes: z.number().int(),
  remark: z.string().nullable(),
});
export type DtrRow = z.infer<typeof dtrRowSchema>;

// ---------------------------------------------------------------------------
// Error logging (core flow 9)
// ---------------------------------------------------------------------------

export const logErrorRequestSchema = z.object({
  source: z.enum(ERROR_SOURCES).exclude(["edge_function"]),
  severity: z.enum(ERROR_SEVERITIES),
  message: z.string().trim().min(1).max(1000),
  context: z.record(z.string(), z.unknown()).optional(),
});
export type LogErrorRequest = z.infer<typeof logErrorRequestSchema>;

// ---------------------------------------------------------------------------
// device-sync contract for a future fingerprint terminal (FR-116, FR-117)
// ---------------------------------------------------------------------------

export const deviceSyncEventSchema = z.object({
  /** Terminal-generated UUID; stored in scan_attempts.nonce so each event is processed at most once. */
  eventId: z.uuid(),
  /** The employee's BHW ID number as enrolled on the terminal. */
  bhwIdNumber,
  /** Terminal clock time of the punch (ISO 8601 with offset). Accepted only within ±5 min of server time on live sync; older events are accepted as backfill and flagged. */
  occurredAt: z.iso.datetime({ offset: true }),
  /** Optional hint from the terminal; the server decides time-in vs time-out itself (D-14). */
  direction: z.enum(["in", "out", "auto"]).default("auto"),
});

export const deviceSyncRequestSchema = z.object({
  stationId: z.uuid(),
  terminalSerial: z.string().min(1).max(100),
  events: z.array(deviceSyncEventSchema).min(1).max(500),
});
export type DeviceSyncRequest = z.infer<typeof deviceSyncRequestSchema>;

export const deviceSyncResponseSchema = z.object({
  ok: z.literal(true),
  results: z.array(
    z.object({
      eventId: z.string(),
      status: z.enum(["recorded", "duplicate", "rejected"]),
      code: z.string().optional(),
      action: z.enum(["time_in", "time_out"]).optional(),
    }),
  ),
});
