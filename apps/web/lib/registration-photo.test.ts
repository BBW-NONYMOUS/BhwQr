import { PHOTO_MAX_BYTES } from "@bhw/types";
import { describe, expect, it } from "vitest";
import {
  checkPhotoFile,
  isRegistrationPhotoPath,
  registrationPhotoPath,
} from "./registration-photo";

const USER = "3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9a0b3e";

describe("checkPhotoFile", () => {
  it("accepts JPG, PNG and WebP up to 5 MB", () => {
    expect(checkPhotoFile({ name: "photo.jpg", type: "image/jpeg", size: 1_600_000 })).toEqual({
      ok: true,
      type: "image/jpeg",
    });
    expect(checkPhotoFile({ name: "Photo.JPEG", type: "image/jpeg", size: 10 })).toMatchObject({
      ok: true,
    });
    expect(
      checkPhotoFile({ name: "me.png", type: "image/png", size: PHOTO_MAX_BYTES }),
    ).toMatchObject({ ok: true });
    expect(checkPhotoFile({ name: "me.webp", type: "image/webp", size: 500 })).toMatchObject({
      ok: true,
    });
  });

  it("rejects files over 5 MB with FILE_TOO_LARGE", () => {
    expect(checkPhotoFile({ name: "big.jpg", type: "image/jpeg", size: 6_100_000 })).toMatchObject({
      ok: false,
      code: "FILE_TOO_LARGE",
    });
  });

  it("rejects other types with FILE_TYPE_NOT_ALLOWED", () => {
    expect(checkPhotoFile({ name: "photo.heic", type: "image/heic", size: 1000 })).toMatchObject({
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
    });
    expect(
      checkPhotoFile({ name: "doc.pdf", type: "application/pdf", size: 9_000_000 }),
    ).toMatchObject({
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
    });
  });

  it("rejects a mismatching extension", () => {
    expect(checkPhotoFile({ name: "photo.exe", type: "image/png", size: 1000 })).toMatchObject({
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
    });
    expect(checkPhotoFile({ name: "photo.png", type: "image/jpeg", size: 1000 })).toMatchObject({
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
    });
  });

  it("rejects empty files", () => {
    expect(checkPhotoFile({ name: "photo.png", type: "image/png", size: 0 })).toMatchObject({
      ok: false,
    });
  });
});

describe("registration photo paths", () => {
  it("builds a path that matches the profiles.photo_url constraint", () => {
    const path = registrationPhotoPath(USER, "image/jpeg", 1_793_000_000_000);
    expect(path).toBe(`${USER}/photo-1793000000000.jpg`);
    expect(path).toMatch(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/);
    expect(isRegistrationPhotoPath(USER, path)).toBe(true);
  });

  it("rejects paths for another user or with extra segments", () => {
    const other = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(isRegistrationPhotoPath(other, `${USER}/photo-1793000000000.jpg`)).toBe(false);
    expect(isRegistrationPhotoPath(USER, `${USER}/x/photo-1793000000000.jpg`)).toBe(false);
    expect(isRegistrationPhotoPath(USER, `${USER}/avatar.jpg`)).toBe(false);
    expect(isRegistrationPhotoPath(USER, `${USER}/photo-1793000000000.gif`)).toBe(false);
    expect(isRegistrationPhotoPath("not-a-uuid", "not-a-uuid/photo-1793000000000.jpg")).toBe(false);
  });
});
