import { describe, expect, it } from "vitest";
import { formatDate, formatMinutes, formatTime, manilaToday, mondayOf } from "./format";

describe("format", () => {
  it("shows times in Manila", () => {
    expect(formatTime("2026-11-09T23:55:00Z")).toBe("07:55");
    expect(formatTime(null)).toBe("—");
  });
  it("does not shift plain dates", () => {
    expect(formatDate("2026-11-09")).toContain("9");
  });
  it("computes the Manila date", () => {
    expect(manilaToday(new Date("2026-11-09T17:30:00Z"))).toBe("2026-11-10");
  });
  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(135)).toBe("2 h 15 min");
  });
  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-11-12")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
  });
});
