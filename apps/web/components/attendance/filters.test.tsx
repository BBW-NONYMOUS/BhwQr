import { describe, expect, it } from "vitest";

import {
  addDays,
  attendanceEqFilters,
  attendanceFiltersToSearch,
  correctionFiltersToSearch,
  defaultRange,
  isIsoDate,
  parseAttendanceFilters,
  parseCorrectionFilters,
  toManilaHHmm,
} from "./filters";

const TODAY = "2026-11-12";
const EMP = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("date helpers", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-11-09")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("11/09/2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("defaults to the last 7 days including today", () => {
    expect(defaultRange(TODAY)).toEqual({ from: "2026-11-06", to: TODAY });
  });
});

describe("parseAttendanceFilters", () => {
  it("uses the last 7 days and no other filters when the URL is empty", () => {
    expect(parseAttendanceFilters({}, TODAY)).toEqual({
      from: "2026-11-06",
      to: TODAY,
      employeeId: null,
      status: null,
      method: null,
    });
  });

  it("reads valid values and lower-cases the employee id", () => {
    const f = parseAttendanceFilters(
      { from: "2026-11-01", to: "2026-11-10", employee: EMP.toUpperCase(), status: "late", method: "manual" },
      TODAY,
    );
    expect(f).toEqual({ from: "2026-11-01", to: "2026-11-10", employeeId: EMP, status: "late", method: "manual" });
  });

  it("ignores unknown status, method and malformed employee ids", () => {
    const f = parseAttendanceFilters({ status: "present", method: "fingerprint", employee: "1 or 1=1" }, TODAY);
    expect(f.status).toBeNull();
    expect(f.method).toBeNull();
    expect(f.employeeId).toBeNull();
  });

  it("swaps a reversed range and completes a half-open one", () => {
    expect(parseAttendanceFilters({ from: "2026-11-10", to: "2026-11-01" }, TODAY)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-10",
    });
    expect(parseAttendanceFilters({ from: "2026-11-03" }, TODAY)).toMatchObject({ from: "2026-11-03", to: TODAY });
    expect(parseAttendanceFilters({ to: "2026-11-10" }, TODAY)).toMatchObject({ from: "2026-11-04", to: "2026-11-10" });
  });

  it("falls back to the default range for invalid dates and caps very long ranges", () => {
    expect(parseAttendanceFilters({ from: "nope", to: "2026-13-01" }, TODAY)).toMatchObject(defaultRange(TODAY));
    const long = parseAttendanceFilters({ from: "2020-01-01", to: "2026-11-12" }, TODAY);
    expect(long.to).toBe("2026-11-12");
    expect(long.from).toBe("2025-11-12");
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseAttendanceFilters({ status: ["absent", "late"] }, TODAY).status).toBe("absent");
  });

  it("round-trips through the URL", () => {
    const f = parseAttendanceFilters({ from: "2026-11-01", to: "2026-11-10", status: "undertime" }, TODAY);
    const sp = Object.fromEntries(new URLSearchParams(attendanceFiltersToSearch(f)));
    expect(parseAttendanceFilters(sp, TODAY)).toEqual(f);
  });

  it("builds equality filters only for chosen values", () => {
    expect(attendanceEqFilters(parseAttendanceFilters({}, TODAY))).toEqual([]);
    expect(attendanceEqFilters(parseAttendanceFilters({ employee: EMP, method: "qr" }, TODAY))).toEqual([
      ["employee_id", EMP],
      ["method", "qr"],
    ]);
  });
});

describe("parseCorrectionFilters", () => {
  it("defaults to the pending tab", () => {
    expect(parseCorrectionFilters({})).toEqual({ status: "pending", type: null, employeeId: null });
    expect(parseCorrectionFilters({ status: "archived" }).status).toBe("pending");
  });

  it("reads status, type and employee and omits defaults from the URL", () => {
    const f = parseCorrectionFilters({ status: "rejected", type: "wrong_time", employee: EMP });
    expect(f).toEqual({ status: "rejected", type: "wrong_time", employeeId: EMP });
    expect(correctionFiltersToSearch(f)).toBe(`status=rejected&type=wrong_time&employee=${EMP}`);
    expect(correctionFiltersToSearch(parseCorrectionFilters({}))).toBe("");
  });
});

describe("toManilaHHmm", () => {
  it("converts UTC timestamps to Manila 24-hour time", () => {
    expect(toManilaHHmm("2026-11-09T00:05:00Z")).toBe("08:05");
    expect(toManilaHHmm("2026-11-09T09:04:00+00:00")).toBe("17:04");
    expect(toManilaHHmm("2026-11-08T16:00:00Z")).toBe("00:00");
  });

  it("returns null for empty or invalid input", () => {
    expect(toManilaHHmm(null)).toBeNull();
    expect(toManilaHHmm("not a date")).toBeNull();
  });
});
