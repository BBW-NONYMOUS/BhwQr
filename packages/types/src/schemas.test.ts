import { test } from "node:test";
import assert from "node:assert/strict";
import {
  correctionRequestSchema,
  manualEntrySchema,
  registrationSchema,
  scanRequestSchema,
} from "./schemas.ts";
import { errorMessage } from "./messages.ts";
import { isKioskQr, splitQrContent, KIOSK_QR_PREFIX } from "./qr.ts";

const validRegistration = {
  fullName: "Maria Luz D. Santos",
  bhwIdNumber: "bhw-kii-2021-014",
  area: "Purok Malipayon",
  contactNumber: "+63 917 123 4567",
  address: "",
  email: "Maria.Santos@Gmail.com",
  password: "secret123",
  confirmPassword: "secret123",
  consent: true,
};

test("registration normalises BHW ID, phone and email", () => {
  const r = registrationSchema.parse(validRegistration);
  assert.equal(r.bhwIdNumber, "BHW-KII-2021-014");
  assert.equal(r.contactNumber, "09171234567");
  assert.equal(r.email, "maria.santos@gmail.com");
});

test("registration requires consent and matching passwords", () => {
  assert.equal(
    registrationSchema.safeParse({ ...validRegistration, consent: false }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...validRegistration, confirmPassword: "other123" }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...validRegistration, contactNumber: "0812345678" }).success,
    false,
  );
});

test("scan request requires the kiosk prefix", () => {
  const base = {
    token: `${KIOSK_QR_PREFIX}abc.def`,
    deviceId: "6f1c1d4e-2b7a-4c1e-9a55-2f3b9d8e7a10",
    lat: 6.6311,
    lng: 124.6047,
    accuracy: 12,
  };
  assert.equal(scanRequestSchema.safeParse(base).success, true);
  assert.equal(scanRequestSchema.safeParse({ ...base, token: "BHWPQR1:abc.def" }).success, false);
});

test("qr content parsing", () => {
  assert.deepEqual(splitQrContent("BHWQR1:eyJ2IjoxfQ.c2ln", KIOSK_QR_PREFIX), {
    body: "eyJ2IjoxfQ",
    signature: "c2ln",
  });
  assert.equal(isKioskQr("https://example.com"), false);
  assert.equal(isKioskQr("BHWQR1:no-dot"), false);
});

test("manual entry needs a reason and a valid range", () => {
  const base = {
    employeeId: "6f1c1d4e-2b7a-4c1e-9a55-2f3b9d8e7a10",
    workDate: "2026-11-09",
    timeIn: "08:05",
    timeOut: "17:00",
    reason: "Phone battery died at the office",
  };
  assert.equal(manualEntrySchema.safeParse(base).success, true);
  assert.equal(manualEntrySchema.safeParse({ ...base, reason: "short" }).success, false);
  assert.equal(manualEntrySchema.safeParse({ ...base, timeOut: "07:00" }).success, false);
});

test("correction request type rules", () => {
  const base = {
    workDate: "2026-11-09",
    type: "missing_time_out" as const,
    requestedTimeIn: null,
    requestedTimeOut: null,
    reason: "Forgot to scan out after the vaccination drive",
    attachmentPath: null,
  };
  assert.equal(correctionRequestSchema.safeParse(base).success, false);
  assert.equal(
    correctionRequestSchema.safeParse({ ...base, requestedTimeOut: "17:05" }).success,
    true,
  );
});

test("error messages are translated and filled", () => {
  assert.match(errorMessage("OUTSIDE_GEOFENCE", "en", { distance: 240, radius: 100 }), /240 m/);
  assert.match(errorMessage("QR_EXPIRED", "fil"), /Lipas na/);
  assert.equal(errorMessage("NOT_A_CODE"), errorMessage("INTERNAL_ERROR"));
});
