import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { RequestCard } from "@/components/correction/request-card";
import { DtrTable } from "@/components/dtr/dtr-table";
import type { DtrRowData } from "@/components/dtr/format";
import type { CorrectionRequestRow } from "@/lib/queries/requests";

// RNTL 14: render() and fireEvent() are async.

function monthRows(): DtrRowData[] {
  return Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const exists = day <= 30; // a 30-day month
    return {
      day,
      work_date: exists ? `2026-11-${String(day).padStart(2, "0")}` : null,
      am_arrival: day === 2 ? "08:21:00" : null,
      am_departure: null,
      pm_arrival: null,
      pm_departure: day === 2 ? "17:03:00" : null,
      undertime_hours: day === 3 ? 8 : 0,
      undertime_minutes: day === 2 ? 21 : 0,
      remark: day === 1 ? "Sunday" : day === 3 ? "Absent" : null,
      status: day === 2 ? "late" : day === 3 ? "absent" : null,
      method: day === 2 ? "qr" : null,
    };
  });
}

describe("DtrTable", () => {
  it("renders all 31 CSC Form 48 lines with times, undertime and spanning remarks", async () => {
    await render(<DtrTable rows={monthRows()} lang="en" />);

    for (let day = 1; day <= 31; day++) expect(screen.getByTestId(`dtr-row-${day}`)).toBeTruthy();
    expect(screen.getByText("AM in")).toBeTruthy();
    expect(screen.getByText("08:21")).toBeTruthy();
    expect(screen.getByText("17:03")).toBeTruthy();
    expect(within(screen.getByTestId("dtr-row-2")).getByText("21")).toBeTruthy(); // undertime minutes
    expect(screen.getByText("Sunday")).toBeTruthy();
    expect(screen.getByText("Absent")).toBeTruthy();
    expect(screen.getByLabelText("Day 31: —")).toBeTruthy();
  });

  it("translates headers and remarks to Filipino", async () => {
    await render(<DtrTable rows={monthRows()} lang="fil" />);
    expect(screen.getByText("Araw")).toBeTruthy();
    expect(screen.getByText("Linggo")).toBeTruthy();
    expect(screen.getByText("Liban")).toBeTruthy();
  });
});

describe("RequestCard", () => {
  const pending: CorrectionRequestRow = {
    id: "r1",
    work_date: "2026-10-30",
    type: "missing_time_out",
    requested_time_in: null,
    requested_time_out: "2026-10-30T09:05:00+00:00",
    reason: "Phone battery died before I could scan out.",
    attachment_url: null,
    status: "pending",
    remarks: null,
    created_at: "2026-10-30T12:11:52+00:00",
    reviewed_at: null,
  };

  it("shows type, status, Manila requested time and cancels a pending request", async () => {
    const onCancel = jest.fn();
    await render(<RequestCard request={pending} lang="en" onCancel={onCancel} />);

    expect(screen.getByText("Missing time-out")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText(/Out 17:05/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel request"));
    expect(onCancel).toHaveBeenCalledWith(pending);
  });

  it("shows admin remarks and no cancel button once reviewed", async () => {
    await render(
      <RequestCard
        request={{ ...pending, status: "rejected", remarks: "No logbook entry for this day.", reviewed_at: "2026-10-31T01:00:00Z" }}
        lang="fil"
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText("Tinanggihan")).toBeTruthy();
    expect(screen.getByText(/No logbook entry for this day./)).toBeTruthy();
    expect(screen.queryByText("Kanselahin ang hiling")).toBeNull();
  });
});
