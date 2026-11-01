import { useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import { reportError } from "@/lib/api";
import { evaluateHealth, type HealthInputs, type HealthItem, type HealthItemKey } from "@/lib/health-check";
import { DEFAULT_MAX_GPS_ACCURACY_M, useMaxGpsAccuracy } from "@/lib/queries/home";
import { useSession } from "@/lib/session";
import { useOnline } from "@/lib/use-online";

/** A position older than this is refreshed before it is sent with a scan. */
const FRESH_POSITION_MS = 10_000;
const POSITION_TIMEOUT_MS = 8_000;

export interface ScanHealth {
  inputs: HealthInputs;
  items: HealthItem[];
  ready: boolean;
  cameraGranted: boolean;
  /** Runs the "Fix" action for a failed item. */
  fix: (item: HealthItem) => Promise<void>;
  /** Latest position for the scan request (watch value, refreshed when stale); null when unavailable. */
  getScanPosition: () => Promise<Location.LocationObject | null>;
}

function deviceCodeFor(kind: string, reason: string | undefined): HealthInputs["deviceCode"] {
  if (kind === "ready") return "OK";
  if (kind === "needs_binding") return "DEVICE_NOT_BOUND";
  if (kind === "blocked" && reason === "device_mismatch") return "DEVICE_MISMATCH";
  return "ACCOUNT_NOT_ACTIVE";
}

/**
 * Gathers the pre-scan health inputs (FR-45) from expo-camera, expo-location, expo-network and
 * the session, and evaluates them with lib/health-check. Re-checks when the user returns from
 * the phone settings. The GPS watch keeps running while the Scan screen is open so the scan uses
 * a live, accurate position.
 */
export function useScanHealth(): ScanHealth {
  const { gate } = useSession();
  const online = useOnline();
  const maxAccuracyQ = useMaxGpsAccuracy();
  const [cameraPermission, requestCamera, getCamera] = useCameraPermissions();

  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [locationCanAsk, setLocationCanAsk] = useState(true);
  const [servicesEnabled, setServicesEnabled] = useState(true);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [watchKey, setWatchKey] = useState(0);
  const latest = useRef<Location.LocationObject | null>(null);
  const askedCamera = useRef(false);

  const checkServices = useCallback(async () => {
    try {
      setServicesEnabled(await Location.hasServicesEnabledAsync());
    } catch {
      setServicesEnabled(false);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(res.granted);
      setLocationCanAsk(res.canAskAgain);
    } catch (e) {
      setLocationGranted(false);
      void reportError("Location permission request failed", { error: e instanceof Error ? e.message : String(e) }, "warning");
    }
  }, []);

  // Ask for the location permission and read the location services state when the screen opens.
  useEffect(() => {
    let mounted = true;
    Location.requestForegroundPermissionsAsync()
      .then((res) => {
        if (!mounted) return;
        setLocationGranted(res.granted);
        setLocationCanAsk(res.canAskAgain);
      })
      .catch((e: unknown) => {
        if (mounted) setLocationGranted(false);
        void reportError("Location permission request failed", { error: e instanceof Error ? e.message : String(e) }, "warning");
      });
    Location.hasServicesEnabledAsync()
      .then((enabled) => {
        if (mounted) setServicesEnabled(enabled);
      })
      .catch(() => {
        if (mounted) setServicesEnabled(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cameraPermission || cameraPermission.granted || askedCamera.current) return;
    askedCamera.current = true;
    if (cameraPermission.canAskAgain) void requestCamera();
  }, [cameraPermission, requestCamera]);

  // Back from the phone settings: re-read permissions and location services.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void getCamera();
      void Location.getForegroundPermissionsAsync()
        .then((res) => {
          setLocationGranted(res.granted);
          setLocationCanAsk(res.canAskAgain);
        })
        .catch(() => undefined);
      void checkServices();
    });
    return () => sub.remove();
  }, [getCamera, checkServices]);

  // While location services are off, poll so the item turns green as soon as GPS is switched on.
  useEffect(() => {
    if (servicesEnabled || !locationGranted) return;
    const timer = setInterval(() => void checkServices(), 3000);
    return () => clearInterval(timer);
  }, [servicesEnabled, locationGranted, checkServices]);

  // Live GPS accuracy (Accuracy.High) while the Scan screen is open.
  useEffect(() => {
    if (!locationGranted || !servicesEnabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
      (loc) => {
        latest.current = loc;
        setAccuracy(loc.coords.accuracy ?? null);
      },
      () => void checkServices(),
    )
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => void checkServices());
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [locationGranted, servicesEnabled, watchKey, checkServices]);

  const inputs: HealthInputs = useMemo(
    () => ({
      cameraGranted: cameraPermission ? cameraPermission.granted : null,
      locationGranted,
      accuracy,
      locationServicesEnabled: servicesEnabled,
      online,
      deviceCode: deviceCodeFor(gate.kind, gate.kind === "blocked" ? gate.reason : undefined),
      maxAccuracy: maxAccuracyQ.data ?? DEFAULT_MAX_GPS_ACCURACY_M,
    }),
    [cameraPermission, locationGranted, accuracy, servicesEnabled, online, gate, maxAccuracyQ.data],
  );

  const { items, ready } = useMemo(() => evaluateHealth(inputs), [inputs]);

  const fix = useCallback(
    async (item: HealthItem) => {
      const key: HealthItemKey = item.key;
      try {
        if (key === "camera") {
          if (cameraPermission?.canAskAgain) await requestCamera();
          else await Linking.openSettings();
        } else if (key === "location") {
          if (locationCanAsk) await requestLocation();
          else await Linking.openSettings();
        } else if (key === "gps") {
          if (item.code === "LOCATION_UNAVAILABLE") {
            // Android shows the system "turn on location" dialog; iOS can only open Settings.
            if (Platform.OS === "android") await Location.enableNetworkProviderAsync();
            else await Linking.openSettings();
            await checkServices();
          } else {
            // GPS not accurate enough yet: restart the watch and wait for a fresh fix.
            setAccuracy(null);
            setWatchKey((k) => k + 1);
          }
        } else if (key === "internet") {
          if (Platform.OS === "android") {
            await Linking.sendIntent("android.settings.WIRELESS_SETTINGS").catch(() => Linking.openSettings());
          } else {
            await Linking.openSettings();
          }
        }
      } catch {
        // The user declined the system dialog; the item simply stays red with its message.
        await checkServices();
      }
    },
    [cameraPermission, requestCamera, locationCanAsk, requestLocation, checkServices],
  );

  const getScanPosition = useCallback(async (): Promise<Location.LocationObject | null> => {
    const current = latest.current;
    if (current && Date.now() - current.timestamp <= FRESH_POSITION_MS) return current;
    try {
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
      ]);
      if (fresh) latest.current = fresh;
      return fresh ?? current;
    } catch {
      return current;
    }
  }, []);

  return {
    inputs,
    items,
    ready,
    cameraGranted: Boolean(cameraPermission?.granted),
    fix,
    getScanPosition,
  };
}
