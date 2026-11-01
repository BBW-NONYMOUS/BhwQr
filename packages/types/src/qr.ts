// QR token wire format (decisions D-08 and D-12). Pure helpers with no crypto so they run in
// Deno (Edge Functions), Node (Next.js) and React Native alike. Signing/verification lives in
// supabase/functions/_shared/hmac.ts because the secrets never leave the server.

export const KIOSK_QR_PREFIX = "BHWQR1:";
export const PERSONAL_QR_PREFIX = "BHWPQR1:";

export interface KioskQrPayload {
  v: 1;
  /** station_id */
  sid: string;
  /** nonce (uuid v4) */
  n: string;
  /** issued_at, epoch ms (server time) */
  iat: number;
  /** expires_at, epoch ms (server time) */
  exp: number;
}

export interface PersonalQrPayload {
  v: 1;
  /** employee_id */
  eid: string;
  n: string;
  iat: number;
  exp: number;
}

/** Splits "BHWQR1:<b64url json>.<b64url sig>" into its parts without verifying it. */
export function splitQrContent(
  content: string,
  prefix: typeof KIOSK_QR_PREFIX | typeof PERSONAL_QR_PREFIX,
): { body: string; signature: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith(prefix)) return null;
  const token = trimmed.slice(prefix.length);
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  return { body: parts[0], signature: parts[1] };
}

/** True when the scanned text looks like a kiosk QR. The mobile scanner ignores anything else. */
export function isKioskQr(content: string): boolean {
  return splitQrContent(content, KIOSK_QR_PREFIX) !== null;
}

export function isPersonalQr(content: string): boolean {
  return splitQrContent(content, PERSONAL_QR_PREFIX) !== null;
}

/** Remaining validity in whole seconds for a countdown bar; never negative. */
export function secondsUntil(expEpochMs: number, serverNowMs: number): number {
  return Math.max(0, Math.ceil((expEpochMs - serverNowMs) / 1000));
}
