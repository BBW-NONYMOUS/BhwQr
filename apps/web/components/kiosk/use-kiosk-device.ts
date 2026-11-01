"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** Ticks every `intervalMs` with Date.now() (device timeline; used only for elapsed time). */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [intervalMs]);
  return now;
}

/**
 * Keeps the kiosk screen awake with the Screen Wake Lock API when the browser supports it.
 * The lock is released by the browser when the tab is hidden, so it is re-acquired on return.
 */
export function useWakeLock(): void {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) {
        return;
      }
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied (battery saver, missing user activation): the OS display timeout applies.
        // Not an error worth logging; the kiosk setup guide disables sleep on the tablet.
      }
    };
    const onVisibility = () => void acquire();

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, []);
}

function subscribeFullscreen(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

/** Fullscreen state, a toggle, and the "F" keyboard shortcut. */
export function useFullscreen(): { supported: boolean; active: boolean; toggle: () => void } {
  const supported = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenEnabled,
    () => false,
  );
  const active = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  const toggle = useCallback(() => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: "hide" });
    // Rejected when the browser blocks it (e.g. no user gesture); nothing else to do.
    request.catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!document.fullscreenEnabled) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { supported, active, toggle };
}
