import type { AttendanceStatus, CorrectionType } from "@bhw/types";

// Side-by-side comparison for the correction review sheet (FR-73). Mirrors the time rules of
// review_correction_request (BR-63, BR-68, BR-69) so the admin sees what approval will write.
// Status, minutes late and undertime are recomputed by the database on approval.

export interface CurrentRecord {
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus;
}

export interface CorrectionLike {
  type: CorrectionType;
  requested_time_in: string | null;
  requested_time_out: string | null;
}

/** A time after approval: a timestamp, the schedule's start/end (official business), or none. */
export type ResultTime =
  | { kind: "time"; value: string }
  | { kind: "schedule"; edge: "start" | "end" }
  | { kind: "none" };

export interface ComparisonRow {
  field: "time_in" | "time_out";
  label: string;
  current: string | null;
  requested: string | null;
  after: ResultTime;
  changed: boolean;
  /**
   * The employee asked for this time but approval will not write it. Happens for a
   * missing_time_in request that also carries a time-out: the SQL applies only the time-in.
   */
  ignored: boolean;
}

function asTime(value: string | null): ResultTime {
  return value ? { kind: "time", value } : { kind: "none" };
}

function ignoredRequest(requested: string | null, after: ResultTime): boolean {
  if (!requested) return false;
  return after.kind !== "time" || Date.parse(after.value) !== Date.parse(requested);
}

function sameTime(a: ResultTime, current: string | null): boolean {
  if (a.kind === "none") return current === null;
  if (a.kind === "schedule") return false;
  return current !== null && Date.parse(a.value) === Date.parse(current);
}

/** Times the record will have once the request is approved. */
export function timesAfterApproval(
  request: CorrectionLike,
  record: Pick<CurrentRecord, "time_in" | "time_out"> | null,
): { timeIn: ResultTime; timeOut: ResultTime } {
  const curIn = record?.time_in ?? null;
  const curOut = record?.time_out ?? null;
  switch (request.type) {
    case "missing_time_in":
      // A missing time-in request may also carry the time-out (BR-63, migration 20261101000800).
      return { timeIn: asTime(request.requested_time_in), timeOut: asTime(request.requested_time_out ?? curOut) };
    case "missing_time_out":
      return { timeIn: asTime(curIn), timeOut: asTime(request.requested_time_out) };
    case "wrong_time":
      return {
        timeIn: asTime(request.requested_time_in ?? curIn),
        timeOut: asTime(request.requested_time_out ?? curOut),
      };
    case "official_business":
      return {
        timeIn: request.requested_time_in ? asTime(request.requested_time_in) : { kind: "schedule", edge: "start" },
        timeOut: request.requested_time_out
          ? asTime(request.requested_time_out)
          : { kind: "schedule", edge: "end" },
      };
  }
}

/** Rows for the review sheet: current vs requested vs after approval, flagged when changed. */
export function compareCorrection(request: CorrectionLike, record: CurrentRecord | null): ComparisonRow[] {
  const after = timesAfterApproval(request, record);
  const curIn = record?.time_in ?? null;
  const curOut = record?.time_out ?? null;
  return [
    {
      field: "time_in",
      label: "Time-in",
      current: curIn,
      requested: request.requested_time_in,
      after: after.timeIn,
      changed: !sameTime(after.timeIn, curIn),
      ignored: ignoredRequest(request.requested_time_in, after.timeIn),
    },
    {
      field: "time_out",
      label: "Time-out",
      current: curOut,
      requested: request.requested_time_out,
      after: after.timeOut,
      changed: !sameTime(after.timeOut, curOut),
      ignored: ignoredRequest(request.requested_time_out, after.timeOut),
    },
  ];
}

/**
 * Problems the database would reject on approval, shown before the admin clicks Approve
 * (INVALID_TIME_RANGE). Returns null when approval can proceed.
 */
export function approvalBlocker(request: CorrectionLike, record: CurrentRecord | null): string | null {
  const { timeIn, timeOut } = timesAfterApproval(request, record);
  if (timeIn.kind === "none") {
    return "The record has no time-in yet, so a time-out alone cannot be approved. Ask the employee to file a missing time-in request.";
  }
  if (timeIn.kind === "time" && timeOut.kind === "time" && Date.parse(timeOut.value) <= Date.parse(timeIn.value)) {
    return "After this change the time-out would not be later than the time-in.";
  }
  return null;
}
