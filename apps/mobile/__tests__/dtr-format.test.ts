import { dtrFileName, dtrTotalItems, formatDtrTime, toDtrDisplayRow, type DtrRowData } from "@/components/dtr/format";

const empty: DtrRowData = {
  day: 1,
  work_date: "2026-10-01",
  am_arrival: null,
  am_departure: null,
  pm_arrival: null,
  pm_departure: null,
  undertime_hours: 0,
  undertime_minutes: 0,
  remark: null,
  status: null,
  method: null,
};

describe("DTR cell formatting", () => {
  it("trims seconds from SQL time values", () => {
    expect(formatDtrTime("08:21:00")).toBe("08:21");
    expect(formatDtrTime(null)).toBe("");
  });

  it("formats a normal day with arrival/departure and undertime", () => {
    const row = toDtrDisplayRow(
      { ...empty, day: 5, am_arrival: "08:21:00", pm_departure: "17:03:00", undertime_minutes: 21, status: "late", method: "qr" },
      "en",
    );
    expect(row.kind).toBe("times");
    expect(row.cells).toEqual(["08:21", "", "", "17:03"]);
    expect(row.utHours).toBe("0");
    expect(row.utMinutes).toBe("21");
    expect(row.remark).toBeNull();
  });

  it("spans the remark across the time columns on days without times", () => {
    const sat = toDtrDisplayRow({ ...empty, day: 3, remark: "Saturday" }, "en");
    expect(sat.kind).toBe("remark");
    expect(sat.remark).toBe("Saturday");
    expect(sat.muted).toBe(true);
    expect(sat.utHours).toBe("");

    const absent = toDtrDisplayRow({ ...empty, day: 9, remark: "Absent", status: "absent", undertime_hours: 8 }, "fil");
    expect(absent.kind).toBe("remark");
    expect(absent.remark).toBe("Liban");
    expect(absent.muted).toBe(false);
    expect([absent.utHours, absent.utMinutes]).toEqual(["8", "0"]);
  });

  it("keeps the remark as a note when the day also has times", () => {
    const row = toDtrDisplayRow({ ...empty, am_arrival: "08:00:00", remark: "No time-out", status: "incomplete" }, "en");
    expect(row.kind).toBe("times");
    expect(row.remark).toBe("No time-out");
  });

  it("leaves holiday names untranslated and blanks days that do not exist", () => {
    expect(toDtrDisplayRow({ ...empty, remark: "All Saints' Day" }, "fil").remark).toBe("All Saints' Day");
    const feb30 = toDtrDisplayRow({ ...empty, day: 30, work_date: null, undertime_hours: null, undertime_minutes: null }, "en");
    expect(feb30.kind).toBe("blank");
    expect(feb30.cells).toEqual(["", "", "", ""]);
  });

  it("labels totals in both languages and names the PDF", () => {
    const totals = {
      undertime_total_minutes: 546,
      undertime_hours: 9,
      undertime_minutes: 6,
      days_present: 9,
      days_absent: 1,
      days_late: 2,
      days_undertime: 0,
      days_incomplete: 0,
    };
    expect(dtrTotalItems(totals, "en").map((i) => `${i.label}=${i.value}`)).toEqual([
      "Present=9",
      "Absent=1",
      "Late=2",
      "Undertime=0",
      "No time-out=0",
    ]);
    expect(dtrTotalItems(totals, "fil")[0]?.label).toBe("Pumasok");
    expect(dtrFileName("BHW-KII-2019-001", 2026, 3)).toBe("DTR-BHW-KII-2019-001-2026-03.pdf");
  });
});
