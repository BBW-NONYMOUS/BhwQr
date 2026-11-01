import { PERSONAL_QR_PREFIX } from "@bhw/types";

// Pure logic behind the Fallback Scan camera (core flow 5). The camera library reports the same
// code many times per second while it stays in view; the gate lets one read through and drops
// repeats until the code has been out of view for the debounce window.

export const SCAN_DEBOUNCE_MS = 3000;
export const MAX_QR_LENGTH = 1024;

/** True when the text is an employee's personal attendance QR (prefix "BHWPQR1:"). */
export function isPersonalQrContent(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.length > PERSONAL_QR_PREFIX.length &&
    trimmed.length <= MAX_QR_LENGTH &&
    trimmed.startsWith(PERSONAL_QR_PREFIX)
  );
}

export type GateDecision = "accept" | "duplicate" | "not_personal_qr";

export interface ScanGate {
  /** Decides what to do with one camera read at time `now` (ms). */
  check(content: string, now: number): GateDecision;
  /** Forgets every remembered code (e.g. after the station changes). */
  reset(): void;
}

/**
 * Creates a debounce gate. A code is accepted when it has not been seen during the last
 * `windowMs`; every read refreshes its timestamp, so a QR held in front of the camera is sent
 * once, not every 3 s. Non-personal codes are reported once per window so the page can show a
 * hint without flooding screen readers.
 */
export function createScanGate(windowMs: number = SCAN_DEBOUNCE_MS): ScanGate {
  const seen = new Map<string, number>();

  return {
    check(raw, now) {
      const content = raw.trim();
      for (const [key, at] of seen) {
        if (now - at >= windowMs) seen.delete(key);
      }
      const last = seen.get(content);
      seen.set(content, now);
      if (last !== undefined && now - last < windowMs) return "duplicate";
      return isPersonalQrContent(content) ? "accept" : "not_personal_qr";
    },
    reset() {
      seen.clear();
    },
  };
}
