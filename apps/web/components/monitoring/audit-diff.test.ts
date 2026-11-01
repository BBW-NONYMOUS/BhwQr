import { describe, expect, it } from "vitest";

import { changedKeys, diffAuditRow, formatJsonValue, jsonEqual } from "./audit-diff";
import {
  addDays,
  manilaRangeBounds,
  parseAuditLogFilters,
  parseDateRange,
  parseErrorLogFilters,
} from "./log-filters";

describe("diffAuditRow", () => {
  it("lists changed keys first and marks unchanged ones", () => {
    const rows = diffAuditRow(
      { status: "incomplete", time_out: null, employee_id: "e1" },
      { status: "on_time", time_out: "2026-10-03T17:00:00+08:00", employee_id: "e1", reason: "Kiosk lost power" },
    );
    expect(rows.map((r) => [r.key, r.kind])).toEqual([
      ["status", "changed"],
      ["time_out", "changed"],
      ["reason", "added"],
      ["employee_id", "unchanged"],
    ]);
  });

  it("treats an insert as all added and a delete as all removed", () => {
    expect(diffAuditRow(null, { date: "2026-11-30" })).toEqual([
      { key: "date", before: undefined, after: "2026-11-30", kind: "added" },
    ]);
    expect(diffAuditRow({ date: "2026-11-30" }, null)[0]?.kind).toBe("removed");
  });

  it("reports redacted encrypted columns as changed", () => {
    const rows = diffAuditRow({ address_enc: "[changed]" }, { address_enc: "[changed]" });
    expect(rows[0]?.kind).toBe("changed");
    expect(diffAuditRow({ address_enc: "[unchanged]" }, { address_enc: "[unchanged]" })[0]?.kind).toBe("unchanged");
  });

  it("compares nested JSON deeply", () => {
    expect(diffAuditRow({ work_days: [1, 2, 3] }, { work_days: [1, 2, 3] })[0]?.kind).toBe("unchanged");
    expect(diffAuditRow({ work_days: [1, 2, 3] }, { work_days: [1, 2] })[0]?.kind).toBe("changed");
    expect(jsonEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(jsonEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("summarises changed keys and formats values", () => {
    expect(changedKeys({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
    expect(formatJsonValue(undefined)).toBe("—");
    expect(formatJsonValue(null)).toBe("null");
    expect(formatJsonValue([1, 2])).toBe("[1,2]");
  });
});

describe("log filters", () => {
  const today = "2026-11-01";

  it("defaults to the last 7 Manila days and swaps reversed ranges", () => {
    expect(parseDateRange({}, today)).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(parseDateRange({ from: "2026-11-01", to: "2026-10-01" }, today)).toEqual({
      from: "2026-10-01",
      to: "2026-11-01",
    });
    expect(parseDateRange({ from: "bad" }, today).from).toBe("2026-10-26");
  });

  it("converts Manila dates to UTC bounds", () => {
    expect(manilaRangeBounds("2026-11-01", "2026-11-01")).toEqual({
      gte: "2026-10-31T16:00:00.000Z",
      lt: "2026-11-01T16:00:00.000Z",
    });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("accepts only known sources and severities", () => {
    expect(parseErrorLogFilters({ source: "kiosk", severity: "critical" }, today)).toMatchObject({
      source: "kiosk",
      severity: "critical",
    });
    expect(parseErrorLogFilters({ source: "x", severity: "fatal" }, today)).toMatchObject({
      source: null,
      severity: null,
    });
  });

  it("accepts system, uuid actors and safe table names only", () => {
    expect(parseAuditLogFilters({ actor: "system", table: "stations" }, today)).toMatchObject({
      actor: "system",
      table: "stations",
    });
    expect(parseAuditLogFilters({ actor: "9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08" }, today).actor).toBe(
      "9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08",
    );
    expect(parseAuditLogFilters({ actor: "x;drop", table: "a;b" }, today)).toMatchObject({ actor: null, table: null });
  });
});
