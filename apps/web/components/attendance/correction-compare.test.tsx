import { describe, expect, it } from "vitest";

import { approvalBlocker, compareCorrection, timesAfterApproval, type CurrentRecord } from "./correction-compare";

const IN_0758 = "2026-11-09T07:58:00+08:00";
const IN_0816 = "2026-11-09T08:16:00+08:00";
const OUT_1705 = "2026-11-09T17:05:00+08:00";
const OUT_1630 = "2026-11-09T16:30:00+08:00";

const lateRecord: CurrentRecord = { time_in: IN_0816, time_out: OUT_1630, status: "undertime" };
const incomplete: CurrentRecord = { time_in: IN_0816, time_out: null, status: "incomplete" };
const absent: CurrentRecord = { time_in: null, time_out: null, status: "absent" };

describe("timesAfterApproval (mirrors review_correction_request)", () => {
  it("missing_time_out keeps the time-in and sets the time-out", () => {
    const r = timesAfterApproval({ type: "missing_time_out", requested_time_in: null, requested_time_out: OUT_1705 }, incomplete);
    expect(r).toEqual({ timeIn: { kind: "time", value: IN_0816 }, timeOut: { kind: "time", value: OUT_1705 } });
  });

  it("missing_time_in fills an absent day and keeps an existing time-out", () => {
    const r = timesAfterApproval({ type: "missing_time_in", requested_time_in: IN_0758, requested_time_out: null }, absent);
    expect(r).toEqual({ timeIn: { kind: "time", value: IN_0758 }, timeOut: { kind: "none" } });
  });

  it("wrong_time replaces only the times that were requested", () => {
    const r = timesAfterApproval({ type: "wrong_time", requested_time_in: IN_0758, requested_time_out: null }, lateRecord);
    expect(r).toEqual({ timeIn: { kind: "time", value: IN_0758 }, timeOut: { kind: "time", value: OUT_1630 } });
  });

  it("official_business with blank times uses the schedule (BR-69)", () => {
    const r = timesAfterApproval({ type: "official_business", requested_time_in: null, requested_time_out: null }, null);
    expect(r).toEqual({ timeIn: { kind: "schedule", edge: "start" }, timeOut: { kind: "schedule", edge: "end" } });
  });
});

describe("compareCorrection", () => {
  it("flags only the fields that change", () => {
    const rows = compareCorrection(
      { type: "wrong_time", requested_time_in: IN_0758, requested_time_out: null },
      lateRecord,
    );
    expect(rows.map((r) => [r.field, r.changed])).toEqual([
      ["time_in", true],
      ["time_out", false],
    ]);
    expect(rows[0]).toMatchObject({ current: IN_0816, requested: IN_0758 });
  });

  it("treats equal instants in different offsets as unchanged", () => {
    const rows = compareCorrection(
      { type: "wrong_time", requested_time_in: "2026-11-09T00:16:00Z", requested_time_out: null },
      lateRecord,
    );
    expect(rows[0]?.changed).toBe(false);
  });

  it("shows no current times when there is no record", () => {
    const rows = compareCorrection({ type: "wrong_time", requested_time_in: IN_0758, requested_time_out: OUT_1705 }, null);
    expect(rows.map((r) => r.current)).toEqual([null, null]);
    expect(rows.every((r) => r.changed)).toBe(true);
    expect(rows.some((r) => r.ignored)).toBe(false);
  });

  it("applies the time-out of a missing time-in request, fixing an absent day in one request (BR-63)", () => {
    const rows = compareCorrection(
      { type: "missing_time_in", requested_time_in: IN_0758, requested_time_out: OUT_1705 },
      absent,
    );
    expect(rows.map((r) => [r.field, r.changed, r.ignored])).toEqual([
      ["time_in", true, false],
      ["time_out", true, false],
    ]);
  });
});

describe("approvalBlocker", () => {
  it("allows a normal missing time-out", () => {
    expect(
      approvalBlocker({ type: "missing_time_out", requested_time_in: null, requested_time_out: OUT_1705 }, incomplete),
    ).toBeNull();
  });

  it("blocks a time-out-only request on a day without a time-in", () => {
    expect(
      approvalBlocker({ type: "missing_time_out", requested_time_in: null, requested_time_out: OUT_1705 }, absent),
    ).toMatch(/no time-in/);
  });

  it("blocks when the resulting time-out is not after the time-in", () => {
    expect(
      approvalBlocker(
        { type: "wrong_time", requested_time_in: null, requested_time_out: "2026-11-09T08:00:00+08:00" },
        lateRecord,
      ),
    ).toMatch(/not be later/);
  });

  it("never blocks official business with schedule times", () => {
    expect(
      approvalBlocker({ type: "official_business", requested_time_in: null, requested_time_out: null }, null),
    ).toBeNull();
  });
});
