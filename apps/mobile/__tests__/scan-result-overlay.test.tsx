jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import { ScanResultOverlay, type ScanResultOverlayProps } from "@/components/scan/scan-result-overlay";
import { AppThemeProvider } from "@/lib/app-theme";
import { toScanResultView } from "@/lib/scan-result";
import { tamaguiConfig } from "@/tamagui.config";

// RNTL 14: render() and fireEvent() are async.
async function renderOverlay(props: Partial<ScanResultOverlayProps> & Pick<ScanResultOverlayProps, "view">) {
  const onAction = jest.fn();
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppThemeProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <Theme name="light">
            <ScanResultOverlay lang="en" onAction={onAction} onClose={onClose} {...props} />
          </Theme>
        </TamaguiProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
  return { onAction, onClose };
}

describe("Scan Result overlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(Haptics.notificationAsync).mockClear();
  });
  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("shows a successful time-in with status badge, success haptic and auto-dismiss after 4 s", async () => {
    const view = toScanResultView(
      { ok: true, action: "time_in", time: "07:58", status: "on_time", stationName: "Main Office" },
      "en",
    );
    const { onClose } = await renderOverlay({ view, status: "on_time", autoDismissMs: 4000 });

    expect(screen.getByTestId("scan-result-success")).toBeTruthy();
    expect(screen.getByText("Time-in recorded at 07:58")).toBeTruthy();
    expect(screen.getByText("Naitala ang time-in, 07:58")).toBeTruthy(); // other language
    expect(screen.getByTestId("status-badge-on_time")).toBeTruthy();
    expect(screen.getByText(/Main Office/)).toBeTruthy();
    expect(screen.getByTestId("scan-result-success").props.accessibilityLiveRegion).toBe("assertive");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);

    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly geofence error in both languages with a retry action and error haptic", async () => {
    const view = toScanResultView({ ok: false, code: "OUTSIDE_GEOFENCE", params: { distance: 240, radius: 100 } }, "en");
    const { onAction, onClose } = await renderOverlay({ view });

    expect(screen.getByTestId("scan-result-error")).toBeTruthy();
    expect(screen.getByText("Scan not recorded")).toBeTruthy();
    expect(screen.getByText(view.message)).toBeTruthy();
    expect(screen.getByText(view.secondary)).toBeTruthy();
    expect(view.message).toContain("240");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);

    await fireEvent.press(screen.getByText("Try again"));
    expect(onAction).toHaveBeenCalledWith("retry");

    // Errors never auto-dismiss: the employee must read the message.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tells the employee to contact the admin for a device mismatch (no action button)", async () => {
    const view = toScanResultView({ ok: false, code: "DEVICE_MISMATCH" }, "en");
    await renderOverlay({ view });

    expect(screen.getByText("Please contact the BHW office administrator.")).toBeTruthy();
    expect(screen.queryByText("Try again")).toBeNull();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("offers a correction request when the day is already complete", async () => {
    const view = toScanResultView({ ok: false, code: "ALREADY_COMPLETED" }, "en");
    const { onAction } = await renderOverlay({ view });

    expect(screen.getByTestId("scan-result-warning")).toBeTruthy();
    await fireEvent.press(screen.getByText("Request correction"));
    expect(onAction).toHaveBeenCalledWith("correction");
  });

  it("renders nothing when there is no result", async () => {
    await renderOverlay({ view: null });
    expect(screen.queryByTestId(/scan-result-/)).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
