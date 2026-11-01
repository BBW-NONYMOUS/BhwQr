import { describe, expect, it } from "vitest";

import {
  deriveScanAction,
  isTrendEmpty,
  liveScanFromRecord,
  manilaDayStart,
  mergeLiveScans,
  percentOf,
  toDailyRows,
  toLiveScans,
  toTrendChartData,
  type RawLiveScan,
  type TrendRow,
} from "./dashboard-data";

const row = (work_date: string, counts: Partial<Omit<TrendRow, "work_date">> = {}): TrendRow => ({
  work_date,
  on_time: 0,
  late: 0,
  undertime: 0,
  incomplete: 0,
  absent: 0,
  ...counts,
});

describe("toTrendChartData", () => {
  it("sorts oldest first, labels in Manila time and totals every status", () => {
    const points = toTrendChartData([
      row("2026-11-01", { on_time: 3, late: 1 }),
      row("2026-10-26", { on_time: 2, absent: 1, undertime: 1, incomplete: 2 }),
    ]);

    expect(points.map((p) => p.date)).toEqual(["2026-10-26", "2026-11-01"]);
    expect(points[0]).toMatchObject({
      label: "Mon 26",
      on_time: 2,
      late: 0,
      undertime: 1,
      incomplete: 2,
      absent: 1,
      total: 6,
    });
    expect(points[0]?.fullLabel).toContain("Monday");
    expect(points[1]).toMatchObject({ label: "Sun 1", total: 4 });
  });

  it("returns an empty list for missing data", () => {
    expect(toTrendChartData(null)).toEqual([]);
    expect(toTrendChartData(undefined)).toEqual([]);
  });

  it("detects a period without records", () => {
    expect(isTrendEmpty(toTrendChartData([row("2026-11-01"), row("2026-10-31")]))).toBe(true);
    expect(isTrendEmpty(toTrendChartData([row("2026-11-01", { late: 1 })]))).toBe(false);
    expect(isTrendEmpty([])).toBe(true);
  });
});

describe("deriveScanAction", () => {
  const records = [
    { time_in_scan_id: "scan-a", time_out_scan_id: "scan-b" },
    { time_in_scan_id: "scan-c", time_out_scan_id: null },
  ];

  it("maps scan ids to time-in or time-out through the attendance record", () => {
    expect(deriveScanAction("scan-a", records)).toBe("time_in");
    expect(deriveScanAction("scan-b", records)).toBe("time_out");
    expect(deriveScanAction("scan-c", records)).toBe("time_in");
  });

  it("returns null when no record references the scan", () => {
    expect(deriveScanAction("scan-x", records)).toBeNull();
    expect(deriveScanAction("scan-a", [])).toBeNull();
  });
});

describe("toLiveScans", () => {
  it("orders newest first and falls back for missing joins", () => {
    const scans: RawLiveScan[] = [
      {
        id: "s1",
        created_at: "2026-11-01T00:05:00+00:00",
        employee: { full_name: "Maria Santos", bhw_id_number: "BHW-001" },
        station: { name: "Main Office" },
      },
      { id: "s2", created_at: "2026-11-01T00:09:00+00:00", employee: null, station: null },
    ];
    const items = toLiveScans(scans, [{ time_in_scan_id: "s1", time_out_scan_id: null }]);

    expect(items.map((i) => i.id)).toEqual(["s2", "s1"]);
    expect(items[0]).toMatchObject({ employeeName: "Unknown employee", stationName: null, action: null });
    expect(items[1]).toMatchObject({
      employeeName: "Maria Santos",
      bhwIdNumber: "BHW-001",
      stationName: "Main Office",
      action: "time_in",
    });
  });
});

describe("toDailyRows", () => {
  it("keeps employees without a record as null status/time", () => {
    const rows = toDailyRows([
      {
        employee_id: "e1",
        full_name: "Ana Cruz",
        bhw_id_number: "BHW-002",
        area: "Purok 1",
        work_date: "2026-11-01",
        time_in: null as unknown as string,
        time_out: null as unknown as string,
        status: null as unknown as "on_time",
        minutes_late: 0,
        undertime_minutes: 0,
        method: null as unknown as "qr",
        station_name: null as unknown as string,
      },
    ]);
    expect(rows[0]).toMatchObject({ status: null, time_in: null, method: null, station_name: null });
    expect(toDailyRows(null)).toEqual([]);
  });
});

describe("small helpers", () => {
  it("computes rounded percentages safely", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
  });

  it("builds the Manila start-of-day timestamp", () => {
    expect(manilaDayStart("2026-11-01")).toBe("2026-11-01T00:00:00+08:00");
    expect(new Date(manilaDayStart("2026-11-01")).toISOString()).toBe("2026-10-31T16:00:00.000Z");
  });
});

describe("live list from Realtime (AC-05)", () => {
  const directory = {
    employees: { e1: { name: "Fatima S. Abdullah", bhwIdNumber: "BHW-KII-2022-007" } },
    stations: { s1: "BHW Office – Main Entrance" },
  };
  const row = {
    employee_id: "e1",
    station_id: "s1",
    time_in: "2026-11-01T00:01:00Z",
    time_out: null,
    time_in_scan_id: "scan-in",
    time_out_scan_id: null,
  };

  it("builds a time-in item with names from the directory", () => {
    expect(liveScanFromRecord(row, directory)).toEqual({
      id: "scan-in",
      createdAt: "2026-11-01T00:01:00Z",
      employeeName: "Fatima S. Abdullah",
      bhwIdNumber: "BHW-KII-2022-007",
      stationName: "BHW Office – Main Entrance",
      action: "time_in",
    });
  });

  it("builds a time-out item and ignores changes without a scan", () => {
    expect(
      liveScanFromRecord({ ...row, time_out: "2026-11-01T09:00:00Z", time_out_scan_id: "scan-out" }, directory)?.action,
    ).toBe("time_out");
    expect(liveScanFromRecord({ ...row, time_in_scan_id: null }, directory)).toBeNull();
  });

  it("merges without duplicates, newest first", () => {
    const server = [{ id: "a", createdAt: "2026-11-01T00:00:00Z", employeeName: "A", bhwIdNumber: null, stationName: null, action: "time_in" as const }];
    const pending = [
      { ...server[0]!, id: "a" },
      { id: "b", createdAt: "2026-11-01T01:00:00Z", employeeName: "B", bhwIdNumber: null, stationName: null, action: "time_in" as const },
    ];
    expect(mergeLiveScans(server, pending).map((s) => s.id)).toEqual(["b", "a"]);
  });
});
