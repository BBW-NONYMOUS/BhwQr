jest.mock("@/lib/supabase", () => ({ getSupabase: jest.fn() }));
jest.mock("@/lib/api", () => ({ callFunction: jest.fn() }));

import { decideGate, type Profile } from "@/lib/session";

const base: Profile = {
  id: "u1",
  full_name: "Maria Luz D. Santos",
  bhw_id_number: "BHW-KII-2019-001",
  area: "Purok Malipayon",
  email: "maria.santos@bhw.local",
  role: "employee",
  status: "active",
  rejection_reason: null,
  photo_url: null,
};

describe("auth guard (AC-01: a pending user cannot use the app)", () => {
  it("signed out without a profile", () => {
    expect(decideGate(null, false, null)).toEqual({ kind: "signed_out" });
  });
  it("blocks pending, rejected and inactive accounts", () => {
    expect(decideGate({ ...base, status: "pending" }, true, "ok")).toEqual({ kind: "blocked", reason: "pending" });
    expect(decideGate({ ...base, status: "rejected", rejection_reason: "ID not in roster" }, true, "ok")).toEqual({
      kind: "blocked",
      reason: "rejected",
      detail: "ID not in roster",
    });
    expect(decideGate({ ...base, status: "inactive" }, true, "ok")).toEqual({ kind: "blocked", reason: "inactive" });
  });
  it("blocks non-employee roles", () => {
    expect(decideGate({ ...base, role: "admin" }, true, "ok").kind).toBe("blocked");
  });
  it("asks to bind when no phone is bound, blocks another phone", () => {
    expect(decideGate(base, false, null)).toEqual({ kind: "needs_binding" });
    expect(decideGate(base, true, "mismatch")).toEqual({ kind: "blocked", reason: "device_mismatch" });
  });
  it("is ready for an active employee on the bound phone", () => {
    expect(decideGate(base, true, "ok")).toEqual({ kind: "ready" });
  });
});
