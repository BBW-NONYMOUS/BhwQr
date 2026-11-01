import { describe, expect, it } from "vitest";

import {
  countdownPercent,
  countdownSeconds,
  errorCodeFromBody,
  formatDrift,
  isNetworkDbError,
  manilaClockParts,
  retryDelayMs,
  serverClockOffset,
  serverTimeFrom,
  toFeedItems,
} from "./kiosk-utils";

describe("server clock offset", () => {
  it("is server time minus device time at receipt", () => {
    expect(serverClockOffset(1_000_500, 1_000_000)).toBe(500);
    expect(serverClockOffset(1_000_000, 1_002_000)).toBe(-2_000);
  });

  it("projects server time from any later device time", () => {
    const offset = serverClockOffset(10_000, 4_000);
    expect(serverTimeFrom(offset, 4_000)).toBe(10_000);
    expect(serverTimeFrom(offset, 9_000)).toBe(15_000);
  });

  it("ignores a wrong device clock", () => {
    // Device is 1 hour behind; the displayed time still equals the server time.
    const serverNow = Date.UTC(2026, 10, 9, 0, 5, 0);
    const deviceNow = serverNow - 3_600_000;
    const offset = serverClockOffset(serverNow, deviceNow);
    expect(manilaClockParts(serverTimeFrom(offset, deviceNow)).time).toBe("08:05:00");
  });
});

describe("countdown", () => {
  it("is 100% right after a refresh and 0% at the deadline", () => {
    expect(countdownPercent(15_000, 15_000, 0)).toBe(100);
    expect(countdownPercent(15_000, 15_000, 7_500)).toBe(50);
    expect(countdownPercent(15_000, 15_000, 15_000)).toBe(0);
  });

  it("clamps outside the interval and handles a zero interval", () => {
    expect(countdownPercent(15_000, 15_000, 20_000)).toBe(0);
    expect(countdownPercent(15_000, 15_000, -5_000)).toBe(100);
    expect(countdownPercent(15_000, 0, 0)).toBe(0);
  });

  it("rounds remaining seconds up and never goes negative", () => {
    expect(countdownSeconds(15_000, 0)).toBe(15);
    expect(countdownSeconds(15_000, 14_001)).toBe(1);
    expect(countdownSeconds(15_000, 16_000)).toBe(0);
  });

  it("backs off retries up to 15 s", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([3_000, 6_000, 12_000, 15_000, 15_000]);
    expect(retryDelayMs(0)).toBe(3_000);
  });
});

describe("Manila clock", () => {
  it("formats weekday, date and 24-hour time in Asia/Manila", () => {
    // 2026-11-09 15:30:45 UTC = Monday 23:30:45 in Manila (UTC+8)
    const parts = manilaClockParts(Date.UTC(2026, 10, 9, 15, 30, 45));
    expect(parts.weekday).toBe("Monday");
    expect(parts.weekdayFil).toBe("Lunes");
    expect(parts.time).toBe("23:30:45");
    expect(parts.date).toContain("2026");
    expect(parts.date).toContain("November");
  });

  it("rolls over to the next Manila day", () => {
    // 2026-11-08 16:00:00 UTC = Monday 00:00:00 in Manila
    const parts = manilaClockParts(Date.UTC(2026, 10, 8, 16, 0, 0));
    expect(parts.weekday).toBe("Monday");
    expect(parts.time).toBe("00:00:00");
  });
});

describe("feed formatting", () => {
  it("maps rows to labelled items and keeps the newest first", () => {
    const items = toFeedItems([
      { first_name: "Maria", action: "time_out", at_time: "17:02", status: "on_time" },
      { first_name: "Jose", action: "time_in", at_time: "08:20", status: "late" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      firstName: "Maria",
      action: "time_out",
      actionLabel: "Time-out",
      time: "17:02",
      status: "on_time",
    });
    expect(items[1]).toMatchObject({ actionLabel: "Time-in", actionLabelFil: "Pumasok", status: "late" });
  });

  it("gives stable, unique keys even for identical rows", () => {
    const row = { first_name: "Ana", action: "time_in", at_time: "08:00", status: "on_time" };
    const items = toFeedItems([row, row]);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
    expect(toFeedItems([row])[0]!.key).toBe(items[0]!.key);
  });

  it("limits the list and tolerates unknown values", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      first_name: ` Name${i} `,
      action: "something",
      at_time: `08:${String(i).padStart(2, "0")}`,
      status: "unknown",
    }));
    const items = toFeedItems(rows);
    expect(items).toHaveLength(10);
    expect(items[0]).toMatchObject({ firstName: "Name0", action: "time_in", status: null });
  });

  it("tells network failures from database errors", () => {
    expect(isNetworkDbError({ code: "" })).toBe(true);
    expect(isNetworkDbError({})).toBe(true);
    expect(isNetworkDbError({ code: "P0001" })).toBe(false);
    expect(isNetworkDbError(null)).toBe(false);
  });

  it("reads the catalog code from an Edge Function error body", () => {
    expect(errorCodeFromBody({ ok: false, code: "FORBIDDEN", message: "x" })).toBe("FORBIDDEN");
    expect(errorCodeFromBody({ ok: false })).toBeNull();
    expect(errorCodeFromBody("oops")).toBeNull();
    expect(errorCodeFromBody(null)).toBeNull();
  });

  it("formats drift with a sign", () => {
    expect(formatDrift(1_250)).toBe("+1.3 s");
    expect(formatDrift(-12_000)).toBe("−12.0 s");
    expect(formatDrift(0)).toBe("0.0 s");
  });
});
