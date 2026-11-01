import { z } from "zod";

// app_settings ranges (09-data-dictionary.md §5.12, decisions §M). Every key is a column of the
// single row id = 1. The schema, the field metadata and the database CHECKs must agree.

const int = (label: string, min: number, max: number) =>
  z
    .number({ error: `Enter ${label}` })
    .int("Use a whole number")
    .min(min, `Must be between ${min} and ${max}`)
    .max(max, `Must be between ${min} and ${max}`);

export const settingsFormSchema = z
  .object({
    geofence_radius_m: int("the geofence radius", 10, 1000),
    max_gps_accuracy_m: int("the GPS accuracy limit", 5, 200),
    cooldown_minutes: int("the cooldown", 1, 60),
    token_lifetime_seconds: int("the token lifetime", 15, 120),
    token_refresh_seconds: int("the refresh interval", 5, 60),
    selfie_required: z.boolean(),
    selfie_retention_days: int("the retention period", 1, 365),
    overnight_cutoff_hour: int("the cutoff hour", 0, 6),
    correction_window_days: int("the correction window", 0, 15),
    heartbeat_interval_seconds: int("the heartbeat interval", 30, 300),
    dtr_fill_break_times: z.boolean(),
    office_name: z
      .string()
      .trim()
      .min(2, "Office name must be at least 2 characters")
      .max(150, "Office name must be at most 150 characters"),
    office_address: z
      .string()
      .trim()
      .min(2, "Office address must be at least 2 characters")
      .max(200, "Office address must be at most 200 characters"),
  })
  .refine((v) => v.token_refresh_seconds < v.token_lifetime_seconds, {
    path: ["token_refresh_seconds"],
    message: "Refresh interval must be shorter than the token lifetime so tokens overlap",
  });

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
export type NumericSettingKey = {
  [K in keyof SettingsFormValues]: SettingsFormValues[K] extends number ? K : never;
}[keyof SettingsFormValues];
export type BooleanSettingKey = {
  [K in keyof SettingsFormValues]: SettingsFormValues[K] extends boolean ? K : never;
}[keyof SettingsFormValues];

export const SETTINGS_DEFAULTS: SettingsFormValues = {
  geofence_radius_m: 100,
  max_gps_accuracy_m: 50,
  cooldown_minutes: 5,
  token_lifetime_seconds: 30,
  token_refresh_seconds: 15,
  selfie_required: false,
  selfie_retention_days: 30,
  overnight_cutoff_hour: 4,
  correction_window_days: 5,
  heartbeat_interval_seconds: 60,
  dtr_fill_break_times: false,
  office_name: "Barangay Kalawag II Health Workers Office",
  office_address: "Barangay Kalawag II, Isulan, Sultan Kudarat",
};

export interface NumericFieldMeta {
  key: NumericSettingKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  help: string;
}
export interface BooleanFieldMeta {
  key: BooleanSettingKey;
  label: string;
  help: string;
}

export interface SettingsSection {
  title: string;
  description: string;
  numbers: NumericFieldMeta[];
  switches: BooleanFieldMeta[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Location checks",
    description: "Where a phone must be, and how precise its GPS must be, for a scan to count.",
    numbers: [
      {
        key: "geofence_radius_m",
        label: "Default geofence radius",
        unit: "m",
        min: 10,
        max: 1000,
        help: "Used by every station without its own radius. Scans farther than this from the station fail with “outside geofence”. Default 100 m.",
      },
      {
        key: "max_gps_accuracy_m",
        label: "Worst GPS accuracy accepted",
        unit: "m",
        min: 5,
        max: 200,
        help: "Scans whose GPS accuracy radius is larger than this fail with “GPS inaccurate”. Indoors, 30–50 m is typical. Default 50 m.",
      },
    ],
    switches: [],
  },
  {
    title: "Scanning",
    description: "Duplicate protection and optional selfie proof for each scan.",
    numbers: [
      {
        key: "cooldown_minutes",
        label: "Cooldown after a scan",
        unit: "min",
        min: 1,
        max: 60,
        help: "Minutes after a successful scan before the same employee can scan again (prevents accidental double taps). Default 5.",
      },
      {
        key: "selfie_retention_days",
        label: "Selfie retention",
        unit: "days",
        min: 1,
        max: 365,
        help: "Selfie photos are deleted automatically after this many days (Data Privacy Act: keep only as long as needed). Default 30.",
      },
    ],
    switches: [
      {
        key: "selfie_required",
        label: "Require a selfie with every scan",
        help: "When on, the mobile app takes a selfie and scans without one are rejected. Turn on only if buddy punching is a problem.",
      },
    ],
  },
  {
    title: "Kiosk QR and heartbeat",
    description: "How often kiosk QR codes rotate and how quickly an offline kiosk is detected.",
    numbers: [
      {
        key: "token_lifetime_seconds",
        label: "QR token lifetime",
        unit: "s",
        min: 15,
        max: 120,
        help: "How long a kiosk or personal QR code stays valid. Shorter is safer against screenshots. Default 30 s.",
      },
      {
        key: "token_refresh_seconds",
        label: "QR refresh interval",
        unit: "s",
        min: 5,
        max: 60,
        help: "How often a new QR code is shown. Must be shorter than the lifetime so a code never expires while on screen. Default 15 s.",
      },
      {
        key: "heartbeat_interval_seconds",
        label: "Kiosk heartbeat interval",
        unit: "s",
        min: 30,
        max: 300,
        help: "Kiosks report every interval; a kiosk is marked offline after 3 missed heartbeats (3 min at the default 60 s).",
      },
    ],
    switches: [],
  },
  {
    title: "Attendance rules",
    description: "Late-night scans and how long employees can still file corrections.",
    numbers: [
      {
        key: "overnight_cutoff_hour",
        label: "Overnight cutoff hour",
        unit: "h",
        min: 0,
        max: 6,
        help: "A scan before this hour (Manila) closes the previous day's open record instead of starting a new day. Default 4 (04:00). The end-of-day job runs 5 minutes after this hour (Manila) and is rescheduled automatically when you save.",
      },
      {
        key: "correction_window_days",
        label: "Correction window",
        unit: "days",
        min: 0,
        max: 15,
        help: "Days into a new month that employees can still request corrections for the previous month. 0 means current month only. Default 5.",
      },
    ],
    switches: [],
  },
];

export const DTR_SWITCH: BooleanFieldMeta = {
  key: "dtr_fill_break_times",
  label: "Fill lunch break times on the DTR",
  help: "When on, unscanned AM departure / PM arrival cells show the schedule's break start and end (CSC Form 48 practice in some offices). When off, those cells stay blank.",
};

/** Keys whose value differs between two settings objects (for the “unsaved changes” hint). */
export function changedSettingKeys(a: SettingsFormValues, b: SettingsFormValues): (keyof SettingsFormValues)[] {
  return (Object.keys(SETTINGS_DEFAULTS) as (keyof SettingsFormValues)[]).filter((k) => a[k] !== b[k]);
}
