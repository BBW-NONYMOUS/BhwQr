import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CscForm48Copy } from "./csc-form-48";
import {
  type DtrDocument,
  type DtrDocumentRow,
  dtrFileName,
  formatCell,
  formatHoursMinutes,
  parseDtrDocument,
  spanningRemark,
  sumUndertime,
  summarizeDocuments,
  timeCells,
  totalsMatchRows,
  undertimeCells,
} from "./dtr-utils";

function blankRow(day: number, workDate: string | null): DtrDocumentRow {
  return {
    day,
    work_date: workDate,
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
}

/** February 2026 (28 days) with a late day, an absent day, a weekend and a no-time-out day. */
function sampleDoc(): DtrDocument {
  const rows = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return blankRow(day, day <= 28 ? `2026-02-${String(day).padStart(2, "0")}` : null);
  });
  rows[1] = { ...rows[1]!, am_arrival: "08:21:00", pm_departure: "17:03:00", undertime_minutes: 21, status: "late", method: "qr" };
  rows[2] = { ...rows[2]!, undertime_hours: 8, remark: "Absent", status: "absent" };
  rows[3] = { ...rows[3]!, am_arrival: "07:55:00", remark: "No time-out", status: "incomplete", method: "qr" };
  rows[4] = { ...rows[4]!, pm_arrival: "13:30:00", pm_departure: "17:00:00", undertime_hours: 4, undertime_minutes: 30, status: "late" };
  rows[6] = { ...rows[6]!, remark: "Saturday" };
  rows[7] = { ...rows[7]!, remark: "Sunday" };
  return {
    employee: { id: "3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10", full_name: "Maria Luz D. Santos", bhw_id_number: "BHW-KII-2021-014" },
    period: { year: 2026, month: 2, label: "February 2026" },
    office: { name: "Barangay Kalawag II Health Workers Office", address: "Isulan, Sultan Kudarat" },
    office_hours: { regular_days: "Mon, Tue, Wed, Thu, Fri, 08:00–12:00 / 13:00–17:00", saturdays: "" },
    rows,
    totals: {
      undertime_total_minutes: 21 + 480 + 270,
      undertime_hours: 12,
      undertime_minutes: 51,
      days_present: 3,
      days_absent: 1,
      days_late: 2,
      days_undertime: 0,
      days_incomplete: 1,
    },
    certification: "I certify on my honor that the above is a true and correct report.",
    verified_label: "Verified as to the prescribed office hours:",
    generated_at: "2026-03-02T00:15:00+00:00",
  };
}

describe("formatCell", () => {
  it("prints 12-hour times without AM/PM like render.ts", () => {
    expect(formatCell("08:05:00")).toBe("8:05");
    expect(formatCell("12:00:00")).toBe("12:00");
    expect(formatCell("13:30:00")).toBe("1:30");
    expect(formatCell("17:03:00")).toBe("5:03");
    expect(formatCell("00:15:00")).toBe("12:15");
    expect(formatCell(null)).toBe("");
  });

  it("orders the four time cells AM arrival, AM departure, PM arrival, PM departure", () => {
    const row = { ...blankRow(1, "2026-02-01"), am_arrival: "08:00:00", am_departure: "12:01:00", pm_arrival: "12:58:00", pm_departure: "17:10:00" };
    expect(timeCells(row)).toEqual(["8:00", "12:01", "12:58", "5:10"]);
  });
});

describe("remark rows", () => {
  const doc = sampleDoc();

  it("spans Saturday, Sunday and Absent rows that have no arrival", () => {
    expect(spanningRemark(doc.rows[2]!)).toBe("ABSENT");
    expect(spanningRemark(doc.rows[6]!)).toBe("SATURDAY");
    expect(spanningRemark(doc.rows[7]!)).toBe("SUNDAY");
  });

  it("prints times instead of the remark when there is an arrival (No time-out)", () => {
    expect(spanningRemark(doc.rows[3]!)).toBeNull();
    expect(timeCells(doc.rows[3]!)).toEqual(["7:55", "", "", ""]);
  });

  it("never prints a remark on a day that does not exist in the month", () => {
    expect(spanningRemark({ ...doc.rows[29]!, remark: "Sunday" })).toBeNull();
  });

  it("leaves undertime blank when zero and shows hours/minutes otherwise", () => {
    expect(undertimeCells(doc.rows[0]!)).toEqual(["", ""]);
    expect(undertimeCells(doc.rows[1]!)).toEqual(["", "21"]);
    expect(undertimeCells(doc.rows[2]!)).toEqual(["8", ""]);
    expect(undertimeCells(doc.rows[4]!)).toEqual(["4", "30"]);
  });
});

describe("totals", () => {
  it("TOTAL equals the sum of the 31 rows", () => {
    const doc = sampleDoc();
    expect(sumUndertime(doc.rows)).toEqual({ totalMinutes: 771, hours: 12, minutes: 51 });
    expect(totalsMatchRows(doc)).toBe(true);
  });

  it("detects a TOTAL that does not match the rows", () => {
    const doc = sampleDoc();
    expect(totalsMatchRows({ ...doc, totals: { ...doc.totals, undertime_minutes: 50 } })).toBe(false);
  });

  it("summary cards add up the document totals across a batch", () => {
    const a = sampleDoc();
    const b = { ...sampleDoc(), employee: { ...a.employee, id: "other" } };
    const s = summarizeDocuments([a, b]);
    expect(s).toMatchObject({ employees: 2, days_present: 6, days_absent: 2, days_late: 4, days_incomplete: 2, undertime_total_minutes: 1542 });
    expect(formatHoursMinutes(s.undertime_total_minutes)).toBe("25:42");
  });
});

describe("parseDtrDocument", () => {
  it("accepts the get_dtr shape and rejects a document without 31 rows", () => {
    const doc = sampleDoc();
    expect(parseDtrDocument(JSON.parse(JSON.stringify(doc))).rows).toHaveLength(31);
    expect(() => parseDtrDocument({ ...doc, rows: doc.rows.slice(0, 30) })).toThrow();
  });

  it("names PDF files per employee or batch", () => {
    expect(dtrFileName([sampleDoc()], 2026, 2)).toBe("DTR-Maria-Luz-D-Santos-2026-02.pdf");
    expect(dtrFileName([sampleDoc(), sampleDoc()], 2026, 2)).toBe("DTR-batch-2026-02.pdf");
  });
});

describe("CscForm48Copy", () => {
  it("renders the CSC Form 48 header, 31 rows, spanning remarks and the TOTAL line", () => {
    render(<CscForm48Copy doc={sampleDoc()} />);
    expect(screen.getByText("Civil Service Form No. 48")).toBeTruthy();
    expect(screen.getByText("DAILY TIME RECORD")).toBeTruthy();
    expect(screen.getByText("-----o0o-----")).toBeTruthy();
    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row").slice(2, -1);
    expect(bodyRows).toHaveLength(31);
    const absent = within(bodyRows[2]!).getByText("ABSENT");
    expect(absent.getAttribute("colspan")).toBe("4");
    expect(within(bodyRows[1]!).getByText("8:21")).toBeTruthy();
    const total = within(table).getAllByRole("row").at(-1)!;
    expect(within(total).getByText("TOTAL")).toBeTruthy();
    expect(within(total).getByText("12")).toBeTruthy();
    expect(within(total).getByText("51")).toBeTruthy();
    expect(screen.getByText("In Charge")).toBeTruthy();
    expect(screen.getByText("Verified as to the prescribed office hours:")).toBeTruthy();
  });
});
