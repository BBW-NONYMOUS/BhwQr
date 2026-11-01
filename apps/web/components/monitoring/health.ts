// Pure helpers for Device Health (FR-108..FR-113, decisions §K / D-34).

/**
 * Wall-clock time for a server render. Call it only after the request has read uncached data
 * (cookies / Supabase), as Cache Components requires; relative times are computed from it.
 */
export function requestTime(): number {
  return Date.now();
}

/** A kiosk is offline after 3 missed heartbeats (D-34). */
export const MISSED_HEARTBEATS_OFFLINE = 3;
/** Clock drift above 30 s (absolute) is a warning (D-34). */
export const DRIFT_WARNING_MS = 30_000;

export type StationHealth = "online" | "offline" | "never" | "inactive";

export interface StationHealthInput {
  is_active: boolean;
  is_online: boolean;
  last_seen_at: string | null;
}

/**
 * Online classification. The database flag (set by the heartbeat and the per-minute offline job)
 * is trusted, but a station whose last heartbeat is older than 3 intervals is shown as offline
 * even before the job has run, so the page never claims "online" for a silent kiosk.
 */
export function classifyStation(s: StationHealthInput, nowMs: number, heartbeatIntervalSeconds: number): StationHealth {
  if (!s.is_active) return "inactive";
  if (!s.last_seen_at) return "never";
  const ageMs = nowMs - Date.parse(s.last_seen_at);
  const limitMs = MISSED_HEARTBEATS_OFFLINE * heartbeatIntervalSeconds * 1000;
  return s.is_online && ageMs <= limitMs ? "online" : "offline";
}

/** "just now", "45 s ago", "3 min ago", "2 h ago", "4 d ago"; "never" for null. */
export function formatRelative(ts: string | null, nowMs: number): string {
  if (!ts) return "never";
  const diffS = Math.round((nowMs - Date.parse(ts)) / 1000);
  if (diffS < 0) return diffS > -60 ? "just now" : "in the future";
  if (diffS < 10) return "just now";
  if (diffS < 60) return `${diffS} s ago`;
  const m = Math.floor(diffS / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export type DriftLevel = "ok" | "warning" | "unknown";

export function driftLevel(driftMs: number | null | undefined): DriftLevel {
  if (driftMs === null || driftMs === undefined) return "unknown";
  return Math.abs(driftMs) > DRIFT_WARNING_MS ? "warning" : "ok";
}

/** "+1.2 s" / "−45.0 s" / "+850 ms" */
export function formatDrift(driftMs: number): string {
  const sign = driftMs < 0 ? "−" : "+";
  const abs = Math.abs(driftMs);
  return abs < 1000 ? `${sign}${abs} ms` : `${sign}${(abs / 1000).toFixed(1)} s`;
}

export interface HeartbeatPoint {
  /** Minutes ago at the start of the bucket, e.g. 60, 55, … 5. */
  label: string;
  count: number;
}

/**
 * Buckets heartbeat timestamps of the last `windowMinutes` into `bucketMinutes` slices, oldest
 * first, for the sparkline. Each bucket's expected count is bucketMinutes*60/interval.
 */
export function bucketHeartbeats(
  timestamps: readonly string[],
  nowMs: number,
  windowMinutes = 60,
  bucketMinutes = 5,
): HeartbeatPoint[] {
  const n = Math.ceil(windowMinutes / bucketMinutes);
  const counts = new Array<number>(n).fill(0);
  const start = nowMs - windowMinutes * 60_000;
  for (const ts of timestamps) {
    const t = Date.parse(ts);
    if (Number.isNaN(t) || t < start || t > nowMs) continue;
    const idx = Math.min(n - 1, Math.floor((t - start) / (bucketMinutes * 60_000)));
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts.map((count, i) => ({ label: `${windowMinutes - i * bucketMinutes} min ago`, count }));
}

export interface FailedScan {
  error_code: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface FailureGroup {
  code: string;
  count: number;
  latestReason: string | null;
  latestAt: string;
}

/** Groups failed scan attempts by error code, most frequent first (ties: most recent first). */
export function groupFailures(rows: readonly FailedScan[]): FailureGroup[] {
  const map = new Map<string, FailureGroup>();
  for (const r of rows) {
    const code = r.error_code ?? "UNKNOWN";
    const g = map.get(code);
    if (!g) {
      map.set(code, { code, count: 1, latestReason: r.failure_reason, latestAt: r.created_at });
      continue;
    }
    g.count += 1;
    if (Date.parse(r.created_at) > Date.parse(g.latestAt)) {
      g.latestAt = r.created_at;
      g.latestReason = r.failure_reason;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || Date.parse(b.latestAt) - Date.parse(a.latestAt));
}

/** Short admin-facing description of each server scan error code (decisions §D). */
export const SCAN_ERROR_LABELS: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: "Not signed in or session expired",
  RATE_LIMITED: "Too many requests from the device",
  INVALID_REQUEST: "Malformed scan request",
  ACCOUNT_NOT_ACTIVE: "Account pending, rejected or inactive",
  DEVICE_NOT_BOUND: "Phone not registered to the employee",
  DEVICE_MISMATCH: "Scan from a different phone than the bound one",
  QR_INVALID: "QR signature invalid or not a kiosk code",
  QR_EXPIRED: "QR code expired (old screenshot or slow scan)",
  QR_UNKNOWN: "QR code not issued by this system",
  QR_REUSED: "QR code already used by this employee",
  STATION_INACTIVE: "Station is deactivated",
  GPS_INACCURATE: "GPS accuracy worse than the limit",
  OUTSIDE_GEOFENCE: "Phone outside the station geofence",
  COOLDOWN_ACTIVE: "Scanned again within the cooldown",
  ALREADY_COMPLETED: "Time-in and time-out already recorded today",
  SELFIE_REQUIRED: "Selfie missing while selfies are required",
  INTERNAL_ERROR: "Server error while recording",
  UNKNOWN: "No error code recorded",
};
