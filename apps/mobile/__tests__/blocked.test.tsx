import type { Lang } from "@bhw/types";

const mockSignOut = jest.fn(() => Promise.resolve());
const mockRefresh = jest.fn(() => Promise.resolve());
let mockGate: { kind: "blocked"; reason: string; detail?: string | null } = { kind: "blocked", reason: "pending" };
let mockLang: Lang = "en";

jest.mock("@/lib/session", () => ({
  useSession: () => ({ gate: mockGate, signOut: mockSignOut, refresh: mockRefresh }),
}));
jest.mock("@/lib/preferences", () => {
  const { STRINGS } = jest.requireActual("@/lib/messages");
  return {
    usePreferences: () => ({
      lang: mockLang,
      setLang: jest.fn(),
      t: (key: string) => STRINGS[mockLang][key],
    }),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BlockedScreen from "@/app/(auth)/blocked";
import { BLOCKED_COPY, type BlockedReason } from "@/components/auth/copy";

async function renderBlocked() {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <BlockedScreen />
    </SafeAreaProvider>,
  );
}

const REASONS: BlockedReason[] = ["pending", "rejected", "inactive", "not_employee", "device_mismatch"];

describe("Blocked screen (AC-01: a pending user cannot use the app)", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockRefresh.mockClear();
    mockLang = "en";
  });

  it.each(REASONS)("explains '%s' in English and Filipino and can log out", async (reason) => {
    mockGate = { kind: "blocked", reason };
    await renderBlocked();

    expect(screen.getByTestId(`blocked-${reason}`)).toBeTruthy();
    expect(screen.getByText(BLOCKED_COPY[reason].en.title)).toBeTruthy();
    expect(screen.getByText(BLOCKED_COPY[reason].fil.title)).toBeTruthy();
    expect(screen.getByText(BLOCKED_COPY[reason].en.next)).toBeTruthy();

    await fireEvent.press(screen.getByText("Log out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows the administrator's rejection reason", async () => {
    mockGate = { kind: "blocked", reason: "rejected", detail: "BHW ID is not in the barangay roster." };
    await renderBlocked();
    expect(screen.getByTestId("blocked-detail")).toHaveTextContent("BHW ID is not in the barangay roster.");
    expect(screen.queryByText("Check again")).toBeNull();
  });

  it("lets a pending employee check again after approval", async () => {
    mockGate = { kind: "blocked", reason: "pending" };
    await renderBlocked();
    await fireEvent.press(screen.getByText("Check again"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not offer 'Check again' to non-employee accounts", async () => {
    mockGate = { kind: "blocked", reason: "not_employee" };
    await renderBlocked();
    expect(screen.queryByText("Check again")).toBeNull();
  });

  it("uses Filipino first when the language is FIL", async () => {
    mockLang = "fil";
    mockGate = { kind: "blocked", reason: "device_mismatch" };
    await renderBlocked();
    expect(screen.getByText(BLOCKED_COPY.device_mismatch.fil.title)).toBeTruthy();
    expect(screen.getByText("Mag-log out")).toBeTruthy();
    expect(screen.getByText("Suriin muli")).toBeTruthy();
  });
});
