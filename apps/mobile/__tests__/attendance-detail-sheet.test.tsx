import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import { AttendanceDetailSheet, suggestedCorrectionType } from "@/components/history/attendance-detail-sheet";
import type { HistoryRow } from "@/lib/queries/history";
import { tamaguiConfig } from "@/tamagui.config";

const row: HistoryRow = {
  id: "a1",
  work_date: "2026-10-23",
  time_in: "2026-10-23T00:30:14+00:00",
  time_out: "2026-10-23T09:07:14+00:00",
  status: "late",
  minutes_late: 30,
  undertime_minutes: 0,
  method: "qr",
  notes: null,
  station_name: "BHW Office – Main Entrance",
  pending_correction: false,
};

async function renderSheet(props: Partial<React.ComponentProps<typeof AttendanceDetailSheet>> = {}) {
  const onRequestCorrection = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name="light">
          <AttendanceDetailSheet
            row={row}
            open
            onOpenChange={jest.fn()}
            lang="en"
            canCorrect
            onRequestCorrection={onRequestCorrection}
            {...props}
          />
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  return { onRequestCorrection };
}

describe("AttendanceDetailSheet (Tamagui Sheet)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("shows Manila times, late minutes and station, and requests a correction", async () => {
    const { onRequestCorrection } = await renderSheet();
    expect(await screen.findByText("08:30")).toBeTruthy();
    expect(screen.getByText("17:07")).toBeTruthy();
    expect(screen.getByText("30 min")).toBeTruthy();
    expect(screen.getByText("BHW Office – Main Entrance")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Request correction"));
    expect(onRequestCorrection).toHaveBeenCalledWith(row);
  });

  it("explains a pending correction", async () => {
    await renderSheet({ row: { ...row, pending_correction: true } });
    expect(await screen.findByText(/waiting for the admin's review/)).toBeTruthy();
  });

  it("suggests the correction type from the record", () => {
    expect(suggestedCorrectionType({ status: "absent", time_in: null, time_out: null })).toBe("missing_time_in");
    expect(suggestedCorrectionType({ status: "incomplete", time_in: "x", time_out: null })).toBe("missing_time_out");
    expect(suggestedCorrectionType({ status: "late", time_in: "x", time_out: "y" })).toBe("wrong_time");
  });
});
