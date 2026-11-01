import { evaluateHealth, type HealthInputs } from "@/lib/health-check";
import { toScanResultView } from "@/lib/scan-result";

const healthy: HealthInputs = {
  cameraGranted: true,
  locationGranted: true,
  accuracy: 12,
  locationServicesEnabled: true,
  online: true,
  deviceCode: "OK",
  maxAccuracy: 50,
};

describe("scan result handling", () => {
  it("shows a success overlay for an on-time time-in", () => {
    const v = toScanResultView({ ok: true, action: "time_in", time: "07:58", status: "on_time", stationName: "Main" }, "en");
    expect(v.tone).toBe("success");
    expect(v.haptic).toBe("success");
    expect(v.title).toBe("Time-in recorded at 07:58");
    expect(v.secondary).toBe("Naitala ang time-in, 07:58");
  });

  it("warns for a late time-in and shows minutes", () => {
    const v = toScanResultView({ ok: true, action: "time_in", time: "08:16", status: "late", minutesLate: 16 }, "en");
    expect(v.tone).toBe("warning");
    expect(v.message).toContain("16 min late");
  });

  it("fills geofence parameters in both languages", () => {
    const v = toScanResultView({ ok: false, code: "OUTSIDE_GEOFENCE", params: { distance: 240, radius: 100 } }, "fil");
    expect(v.tone).toBe("error");
    expect(v.haptic).toBe("error");
    expect(v.message).toContain("240");
    expect(v.secondary).toContain("240 m");
    expect(v.action).toBe("retry");
  });

  it("maps codes to follow-up actions", () => {
    expect(toScanResultView({ ok: false, code: "ALREADY_COMPLETED" }, "en").action).toBe("correction");
    expect(toScanResultView({ ok: false, code: "DEVICE_MISMATCH" }, "en").action).toBe("contact_admin");
    expect(toScanResultView({ ok: false, code: "CAMERA_DENIED" }, "en").action).toBe("settings");
    expect(toScanResultView({ ok: false, code: "AUTH_REQUIRED" }, "en").action).toBe("login");
    expect(toScanResultView({ ok: false, code: "QR_EXPIRED" }, "en").action).toBe("retry");
  });

  it("never shows a raw code for unknown errors", () => {
    const v = toScanResultView({ ok: false, code: "SOMETHING_NEW" }, "en");
    expect(v.message).not.toContain("SOMETHING_NEW");
  });
});

describe("pre-scan health check", () => {
  it("is ready when everything is ok", () => {
    expect(evaluateHealth(healthy).ready).toBe(true);
  });

  it("flags denied camera and location", () => {
    const r = evaluateHealth({ ...healthy, cameraGranted: false, locationGranted: false });
    expect(r.ready).toBe(false);
    expect(r.items.find((i) => i.key === "camera")?.code).toBe("CAMERA_DENIED");
    expect(r.items.find((i) => i.key === "location")?.code).toBe("LOCATION_DENIED");
    expect(r.items.find((i) => i.key === "gps")?.state).toBe("pending");
  });

  it("flags poor GPS accuracy with the measured value", () => {
    const gps = evaluateHealth({ ...healthy, accuracy: 85.4 }).items.find((i) => i.key === "gps");
    expect(gps).toEqual({ key: "gps", state: "fail", code: "GPS_INACCURATE", params: { accuracy: 85, max: 50 } });
  });

  it("flags location services off", () => {
    expect(evaluateHealth({ ...healthy, locationServicesEnabled: false }).items.find((i) => i.key === "gps")?.code).toBe(
      "LOCATION_UNAVAILABLE",
    );
  });

  it("flags offline and does not check the device while offline", () => {
    const r = evaluateHealth({ ...healthy, online: false });
    expect(r.items.find((i) => i.key === "internet")?.code).toBe("OFFLINE");
    expect(r.items.find((i) => i.key === "device")?.state).toBe("pending");
  });

  it("flags a phone that is not the bound device", () => {
    expect(evaluateHealth({ ...healthy, deviceCode: "DEVICE_MISMATCH" }).items.find((i) => i.key === "device")?.code).toBe(
      "DEVICE_MISMATCH",
    );
  });
});
