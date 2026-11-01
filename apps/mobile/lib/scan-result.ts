import { errorMessage, statusLabel, type Lang } from "./messages";

/** What the Scan Result overlay shows for a record-attendance response (FR-56). */
export interface ScanResultView {
  tone: "success" | "warning" | "error";
  title: string;
  message: string;
  /** Secondary line in the other language (EN ↔ FIL), shown smaller. */
  secondary: string;
  haptic: "success" | "warning" | "error";
  /** Code of a follow-up action the overlay offers. */
  action: "none" | "retry" | "settings" | "correction" | "contact_admin" | "login";
}

export type ScanResponse =
  | {
      ok: true;
      action: "time_in" | "time_out";
      time: string;
      status: "on_time" | "late" | "undertime" | "absent" | "incomplete";
      minutesLate?: number;
      undertimeMinutes?: number;
      stationName?: string;
    }
  | { ok: false; code: string; params?: Record<string, string | number> };

const RETRYABLE = new Set(["QR_EXPIRED", "QR_REUSED", "GPS_INACCURATE", "OUTSIDE_GEOFENCE", "OFFLINE", "RATE_LIMITED", "INTERNAL_ERROR", "QR_UNKNOWN", "QR_INVALID"]);
const SETTINGS = new Set(["CAMERA_DENIED", "LOCATION_DENIED", "LOCATION_UNAVAILABLE"]);
const ADMIN = new Set(["DEVICE_MISMATCH", "ACCOUNT_NOT_ACTIVE", "STATION_INACTIVE"]);

export function toScanResultView(res: ScanResponse, lang: Lang): ScanResultView {
  const other: Lang = lang === "en" ? "fil" : "en";

  if (res.ok) {
    const label = (l: Lang) =>
      res.action === "time_in"
        ? l === "en" ? `Time-in recorded at ${res.time}` : `Naitala ang time-in, ${res.time}`
        : l === "en" ? `Time-out recorded at ${res.time}` : `Naitala ang time-out, ${res.time}`;
    const detail = (l: Lang) => {
      const parts = [statusLabel(res.status, l)];
      if (res.minutesLate) parts.push(l === "en" ? `${res.minutesLate} min late` : `${res.minutesLate} minutong huli`);
      if (res.undertimeMinutes) parts.push(l === "en" ? `${res.undertimeMinutes} min undertime` : `${res.undertimeMinutes} minutong kulang`);
      if (res.stationName) parts.push(res.stationName);
      return parts.join(" · ");
    };
    const late = res.status === "late" || res.status === "undertime";
    return {
      tone: late ? "warning" : "success",
      title: label(lang),
      message: detail(lang),
      secondary: label(other),
      haptic: late ? "warning" : "success",
      action: "none",
    };
  }

  const params = res.params ?? {};
  const action: ScanResultView["action"] =
    res.code === "AUTH_REQUIRED" || res.code === "DEVICE_NOT_BOUND"
      ? "login"
      : res.code === "ALREADY_COMPLETED"
        ? "correction"
        : SETTINGS.has(res.code)
          ? "settings"
          : ADMIN.has(res.code)
            ? "contact_admin"
            : RETRYABLE.has(res.code)
              ? "retry"
              : "none";
  return {
    tone: res.code === "COOLDOWN_ACTIVE" || res.code === "ALREADY_COMPLETED" ? "warning" : "error",
    title: lang === "en" ? "Scan not recorded" : "Hindi naitala ang scan",
    message: errorMessage(res.code, lang, params),
    secondary: errorMessage(res.code, other, params),
    haptic: "error",
    action,
  };
}
