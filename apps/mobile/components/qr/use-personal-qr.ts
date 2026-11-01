import { useCallback, useEffect, useRef, useState } from "react";

import { callFunction } from "@/lib/api";
import { useSession } from "@/lib/session";

import { QR_FATAL_CODES, qrCountdown, retryDelayMs, serverOffset, type PersonalQrToken } from "./countdown";

export interface PersonalQrState {
  token: PersonalQrToken | null;
  /** Last error code (OFFLINE, DEVICE_MISMATCH, …) or null. */
  errorCode: string | null;
  /** True when the error needs the admin (account / device) and refreshing has stopped. */
  fatal: boolean;
  countdown: ReturnType<typeof qrCountdown> | null;
  start: () => void;
  stop: () => void;
}

/**
 * Rotating personal QR (core flow 5, FR-62). `start`/`stop` are wired to screen focus so no
 * tokens are requested while the screen is hidden. Refreshes every `refreshSeconds`; the
 * countdown runs on the server clock (serverNow − phone time), so a wrong phone clock is harmless.
 */
export function usePersonalQr(): PersonalQrState {
  const { deviceId } = useSession();
  const [token, setToken] = useState<PersonalQrToken | null>(null);
  const [offset, setOffset] = useState(0);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /** Cancels the running refresh loop (timers + a flag that drops late responses). */
  const cancelRef = useRef<(() => void) | null>(null);
  const deviceIdRef = useRef(deviceId);
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  const start = useCallback(() => {
    cancelRef.current?.();
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ticker = setInterval(() => setNow(Date.now()), 500);
    const schedule = (ms: number) => {
      timer = setTimeout(() => void refresh(), ms);
    };

    async function refresh(): Promise<void> {
      if (!active) return;
      const id = deviceIdRef.current;
      if (!id) {
        schedule(500); // the installation id is still loading
        return;
      }
      const sentAt = Date.now();
      const res = await callFunction<PersonalQrToken>("issue-personal-qr", { deviceId: id });
      const receivedAt = Date.now();
      if (!active) return; // the screen lost focus while the request was in flight

      if (res.ok) {
        const next: PersonalQrToken = {
          content: res.content,
          expiresAt: res.expiresAt,
          serverNow: res.serverNow,
          refreshSeconds: res.refreshSeconds,
        };
        const off = serverOffset(res.serverNow, sentAt, receivedAt);
        failures = 0;
        setToken(next);
        setOffset(off);
        setErrorCode(null);
        schedule(Math.max(1_000, qrCountdown(next, Date.now(), off).refreshInMs));
        return;
      }

      setErrorCode(res.code);
      if (QR_FATAL_CODES.has(res.code)) {
        setFatal(true);
        setToken(null);
        clearInterval(ticker);
        return;
      }
      failures += 1;
      schedule(retryDelayMs(failures));
    }

    cancelRef.current = () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(ticker);
    };
    setFatal(false);
    setNow(Date.now());
    void refresh();
  }, []);

  useEffect(() => stop, [stop]);

  const countdown = token ? qrCountdown(token, now, offset) : null;
  return { token, errorCode, fatal, countdown, start, stop };
}
