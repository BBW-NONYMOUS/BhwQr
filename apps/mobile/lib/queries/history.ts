import { isErrorCode, type AttendanceMethod, type AttendanceStatus } from "@bhw/types";
import { useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";

import { historyRange, type HistorySegment } from "@/components/history/range";
import { manilaToday } from "@/components/history/dates";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Errors: SQL functions raise the catalog code itself as the exception message
// (e.g. "CORRECTION_DUPLICATE"); network failures come back without a Postgres code.
// ---------------------------------------------------------------------------

export class AppError extends Error {
  readonly code: string;
  readonly params: Record<string, string | number>;
  constructor(code: string, message?: string, params: Record<string, string | number> = {}) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }
}

const NETWORK_RE = /network|fetch|timed? ?out|abort|connection|offline/i;

/** Maps a PostgREST / Storage / fetch error to a catalog code (OFFLINE, FORBIDDEN, …). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (typeof error === "object" && error !== null ? error : {}) as { message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message.trim() : String(error);
  const code = typeof e.code === "string" ? e.code : "";
  if (isErrorCode(message)) return new AppError(message);
  if (code === "42501") return new AppError("FORBIDDEN", message);
  if (code === "PGRST301" || code === "PGRST303") return new AppError("AUTH_REQUIRED", message);
  if ((!code || code === "ECONNREFUSED") && NETWORK_RE.test(message)) return new AppError("OFFLINE", message);
  return new AppError("INTERNAL_ERROR", message);
}

export function errorCodeOf(error: unknown): string {
  return toAppError(error).code;
}

// ---------------------------------------------------------------------------
// Offline snapshots (FR-115): the last successful answer of each query is saved as JSON in the
// app's document directory, so History / My Requests / My DTR can be viewed without internet.
// Files are per user (the key includes the user id) and are deleted on logout.
// ---------------------------------------------------------------------------

const CACHE_DIR = "bhw-offline";

export interface Snapshot<T> {
  data: T;
  /** Epoch ms when the data was fetched from the server. */
  savedAt: number;
  /** True when the server could not be reached and the saved copy is shown. */
  fromCache: boolean;
}

function snapshotFile(key: readonly (string | number)[]): File {
  const name = key.map((part) => String(part).replace(/[^\w-]+/g, "_")).join("__");
  return new File(Paths.document, CACHE_DIR, `${name}.json`);
}

async function readSnapshot<T>(key: readonly (string | number)[]): Promise<Snapshot<T> | null> {
  try {
    const file = snapshotFile(key);
    if (!file.exists) return null;
    const parsed = JSON.parse(await file.text()) as { data: T; savedAt: number };
    return { data: parsed.data, savedAt: parsed.savedAt, fromCache: true };
  } catch {
    return null;
  }
}

function writeSnapshot<T>(key: readonly (string | number)[], data: T, savedAt: number): void {
  try {
    const dir = new Directory(Paths.document, CACHE_DIR);
    dir.create({ intermediates: true, idempotent: true });
    const file = snapshotFile(key);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ data, savedAt }));
  } catch {
    // Saving the offline copy is best-effort; the live data is still shown.
  }
}

/** Deletes every saved snapshot (called on logout so the next user never sees them). */
export function clearOfflineSnapshots(): void {
  try {
    const dir = new Directory(Paths.document, CACHE_DIR);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to clean up.
  }
}

/**
 * Runs `fetcher`; on success saves a snapshot, on OFFLINE falls back to the last snapshot.
 * Any other error (or OFFLINE without a snapshot) is thrown as an AppError.
 */
export async function fetchWithSnapshot<T>(key: readonly (string | number)[], fetcher: () => Promise<T>): Promise<Snapshot<T>> {
  try {
    const data = await fetcher();
    const savedAt = Date.now();
    writeSnapshot(key, data, savedAt);
    return { data, savedAt, fromCache: false };
  } catch (e) {
    const err = toAppError(e);
    if (err.code === "OFFLINE") {
      const snap = await readSnapshot<T>(key);
      if (snap) return snap;
    }
    throw err;
  }
}

/** Shared TanStack options for cached, offline-viewable queries. */
export const offlineQueryOptions = {
  // "always": the queryFn runs while offline too, so it can fall back to the saved snapshot.
  networkMode: "always",
  gcTime: 24 * 60 * 60 * 1000,
  refetchOnReconnect: true,
  retry: (failureCount: number, error: Error) => errorCodeOf(error) !== "OFFLINE" && failureCount < 2,
} as const;

// ---------------------------------------------------------------------------
// History (get_employee_history)
// ---------------------------------------------------------------------------

/** Row of `get_employee_history` (09-data-dictionary.md §7.6); nullable columns typed as such. */
export interface HistoryRow {
  id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  undertime_minutes: number;
  method: AttendanceMethod;
  notes: string | null;
  station_name: string | null;
  pending_correction: boolean;
}

export const historyKeys = {
  all: ["history"] as const,
  range: (uid: string, from: string, to: string) => ["history", uid, from, to] as const,
};

export async function fetchHistory(uid: string, from: string, to: string): Promise<HistoryRow[]> {
  const { data, error } = await getSupabase().rpc("get_employee_history", { p_employee_id: uid, p_from: from, p_to: to });
  if (error) throw toAppError(error);
  // Generated types mark nullable RETURNS TABLE columns as non-null; HistoryRow is the true shape.
  return (data ?? []) as HistoryRow[];
}

export function useHistory(segment: HistorySegment) {
  const { profile } = useSession();
  const uid = profile?.id ?? "";
  const { from, to } = historyRange(segment, manilaToday());
  const key = historyKeys.range(uid, from, to);
  return useQuery({
    queryKey: key,
    enabled: uid !== "",
    queryFn: () => fetchWithSnapshot(key, () => fetchHistory(uid, from, to)),
    ...offlineQueryOptions,
  });
}
