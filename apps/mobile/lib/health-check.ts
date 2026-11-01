/**
 * Pre-scan health check (FR-45): pure evaluation so it can be unit tested; the Scan screen
 * gathers the inputs from expo-camera, expo-location, expo-network and check_device.
 */
export interface HealthInputs {
  cameraGranted: boolean | null;
  locationGranted: boolean | null;
  /** Latest GPS accuracy in metres, null when no fix yet. */
  accuracy: number | null;
  locationServicesEnabled: boolean;
  online: boolean;
  /** null = not checked yet; otherwise the result of the server device check. */
  deviceCode: null | "OK" | "DEVICE_NOT_BOUND" | "DEVICE_MISMATCH" | "ACCOUNT_NOT_ACTIVE";
  maxAccuracy: number;
}

export type HealthItemKey = "camera" | "location" | "gps" | "internet" | "device";
export type HealthState = "ok" | "pending" | "fail";

export interface HealthItem {
  key: HealthItemKey;
  state: HealthState;
  /** Catalog code explaining the failure (mobile-only codes or server codes). */
  code?: string;
  params?: Record<string, string | number>;
}

export function evaluateHealth(i: HealthInputs): { items: HealthItem[]; ready: boolean } {
  const items: HealthItem[] = [
    i.cameraGranted === null
      ? { key: "camera", state: "pending" }
      : i.cameraGranted
        ? { key: "camera", state: "ok" }
        : { key: "camera", state: "fail", code: "CAMERA_DENIED" },
    i.locationGranted === null
      ? { key: "location", state: "pending" }
      : i.locationGranted
        ? { key: "location", state: "ok" }
        : { key: "location", state: "fail", code: "LOCATION_DENIED" },
    !i.locationGranted
      ? { key: "gps", state: "pending" }
      : !i.locationServicesEnabled
        ? { key: "gps", state: "fail", code: "LOCATION_UNAVAILABLE" }
        : i.accuracy === null
          ? { key: "gps", state: "pending" }
          : i.accuracy <= i.maxAccuracy
            ? { key: "gps", state: "ok", params: { accuracy: Math.round(i.accuracy) } }
            : {
                key: "gps",
                state: "fail",
                code: "GPS_INACCURATE",
                params: { accuracy: Math.round(i.accuracy), max: i.maxAccuracy },
              },
    i.online ? { key: "internet", state: "ok" } : { key: "internet", state: "fail", code: "OFFLINE" },
    !i.online || i.deviceCode === null
      ? { key: "device", state: "pending" }
      : i.deviceCode === "OK"
        ? { key: "device", state: "ok" }
        : { key: "device", state: "fail", code: i.deviceCode },
  ];
  return { items, ready: items.every((item) => item.state === "ok") };
}
