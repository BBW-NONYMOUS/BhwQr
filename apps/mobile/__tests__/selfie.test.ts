jest.mock("@/lib/supabase", () => ({ getSupabase: jest.fn() }));
jest.mock("@/lib/api", () => ({ reportError: jest.fn() }));

import { scanRequestSchema } from "@bhw/types";

import { selfiePath } from "@/components/scan/selfie-capture";

describe("optional selfie (FR-57)", () => {
  const uid = "3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10";
  const id = "8c2f4e61-0d9a-4b7e-a3c5-9f1e2d7b6a04";

  it("stores the selfie in the employee's own folder (storage RLS) per Manila day", () => {
    expect(selfiePath(uid, "2026-11-09", id)).toBe(`${uid}/2026-11-09/${id}.jpg`);
  });

  it("the path is accepted by the scan request schema", () => {
    const parsed = scanRequestSchema.safeParse({
      token: "BHWQR1:abc.def",
      deviceId: "6f1c1d4e-2b7a-4c1e-9a55-2f3b9d8e7a10",
      lat: 6.6311,
      lng: 124.6047,
      accuracy: 10,
      selfiePath: selfiePath(uid, "2026-11-09", id),
    });
    expect(parsed.success).toBe(true);
  });
});
