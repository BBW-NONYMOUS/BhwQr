import type { HomeRecord, HomeSchedule } from "@/lib/queries/home";

const mockPush = jest.fn();
const mockAuthenticate = jest.fn();
let mockBiometric = false;
let mockOnline = true;

// RN Reusables Progress animates with Reanimated 4, whose native worklets runtime (and its jest
// mock, which still initialises the CSS module) cannot load under jest: render a plain stub.
jest.mock("@/components/ui/progress", () => {
  const { View } = require("react-native");
  const Progress = ({ value }: { value?: number | null }) => <View testID="progress" accessibilityValue={{ now: value ?? 0 }} />;
  return { Progress };
});
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  router: { push: (...args: unknown[]) => mockPush(...args), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock("expo-local-authentication", () => ({
  authenticateAsync: (...args: unknown[]) => mockAuthenticate(...args),
}));
jest.mock("@/lib/use-online", () => ({ useOnline: () => mockOnline }));
jest.mock("@/lib/session", () => ({
  useSession: () => ({ profile: { id: "u1", full_name: "Maria Luz D. Santos" } }),
}));
jest.mock("@/lib/preferences", () => {
  const { STRINGS } = jest.requireActual("@/lib/messages");
  return {
    usePreferences: () => ({ lang: "en", biometricUnlock: mockBiometric, t: (key: string) => STRINGS.en[key] }),
  };
});

const mockToday = "2026-11-02"; // a Monday
const mockRecord: HomeRecord = {
  id: "r1",
  work_date: mockToday,
  time_in: "2026-11-02T00:16:00Z", // 08:16 Manila
  time_out: null,
  status: "late",
  minutes_late: 16,
  undertime_minutes: 0,
};
const mockSchedule: HomeSchedule = {
  name: "Regular",
  start_time: "08:00:00",
  end_time: "17:00:00",
  grace_minutes: 15,
  work_days: [1, 2, 3, 4, 5],
};
const mockOk = <T,>(data: T) => ({ data, isPending: false, isError: false, refetch: jest.fn(() => Promise.resolve()) });

jest.mock("@/lib/queries/home", () => {
  const actual = jest.requireActual("@/lib/queries/home");
  return {
    ...actual,
    manilaToday: () => mockToday,
    useTodayRecord: () => mockOk(mockRecord),
    useCurrentSchedule: () => mockOk(mockSchedule),
    useWeekProgress: () => ({ ...mockOk({ presentDates: [mockToday], holidays: [] }), summary: { present: 1, scheduled: 5, percent: 20 } }),
    useRecentRecords: () => mockOk([mockRecord]),
    useUnreadNotifications: () => mockOk(2),
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import HomeScreen from "@/app/(tabs)/index";
import { GluestackUIProvider } from "@/components/gluestack/gluestack-ui-provider";
import { AppThemeProvider } from "@/lib/app-theme";
import { PAPER_THEME } from "@/lib/theme";
import { tamaguiConfig } from "@/tamagui.config";

// Same library providers as app/_layout.tsx (minus fonts/navigation/session), so the Home screen
// renders RN Reusables, Paper (FAB) and gluestack (toast) together in one tree.
// RNTL 14: render() and fireEvent() are async.
async function renderHome() {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppThemeProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <Theme name="light">
            <PaperProvider theme={PAPER_THEME.light}>
              <GluestackUIProvider mode="light">
                <HomeScreen />
              </GluestackUIProvider>
            </PaperProvider>
          </Theme>
        </TamaguiProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("Home tab", () => {
  // Fake timers so the toast's auto-dismiss timer and provider animations cannot outlive the test.
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
    mockAuthenticate.mockReset();
    mockBiometric = false;
    mockOnline = true;
  });
  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("shows the greeting, Today card, week progress, recent records and unread banner", async () => {
    await renderHome();

    expect(screen.getByText(/Maria$/)).toBeTruthy();
    expect(screen.getByTestId("today-card")).toBeTruthy();
    expect(screen.getAllByTestId("status-badge-late").length).toBeGreaterThan(0);
    expect(screen.getByText("16 min late")).toBeTruthy();
    expect(screen.getByText(/Regular/)).toBeTruthy();
    expect(screen.getByText("1/5")).toBeTruthy();
    expect(screen.getByTestId("progress").props.accessibilityValue).toEqual({ now: 20 });
    expect(screen.getByTestId("recent-card")).toBeTruthy();
    expect(screen.getByText("You have 2 unread notifications.")).toBeTruthy();
  });

  it("opens the Scan screen from the Paper FAB", async () => {
    await renderHome();
    await fireEvent.press(screen.getByLabelText("Scan the kiosk QR code to record attendance"));
    expect(mockPush).toHaveBeenCalledWith("/scan");
  });

  it("asks for the phone biometric first and shows a gluestack toast when it fails", async () => {
    mockBiometric = true;
    mockAuthenticate.mockResolvedValue({ success: false, error: "authentication_failed" });
    await renderHome();

    await fireEvent.press(screen.getByLabelText("Scan the kiosk QR code to record attendance"));
    expect(mockAuthenticate).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await screen.findByText(/Fingerprint or Face ID check did not succeed/)).toBeTruthy();
  });

  it("disables scanning while offline (scans are never queued)", async () => {
    mockOnline = false;
    await renderHome();
    const fab = screen.getByLabelText("Scanning is off while you are offline");
    await fireEvent.press(fab);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
