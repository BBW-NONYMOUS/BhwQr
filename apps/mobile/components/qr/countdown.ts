/** Personal QR from `issue-personal-qr` (core flow 5, FR-62). */
export interface PersonalQrToken {
  content: string;
  /** Server epoch ms when the token stops being accepted. */
  expiresAt: number;
  /** Server epoch ms when the token was issued. */
  serverNow: number;
  /** How often the app fetches a new token (app_settings.token_refresh_seconds). */
  refreshSeconds: number;
}

/**
 * Server clock offset in ms (server − phone). The phone clock may be wrong, so the countdown is
 * computed on server time. The request's midpoint is used as the moment the server answered.
 */
export function serverOffset(serverNow: number, sentAt: number, receivedAt: number): number {
  return serverNow - Math.round((sentAt + receivedAt) / 2);
}

export interface QrCountdown {
  /** Whole seconds until the next refresh (0 when it is due). */
  secondsLeft: number;
  /** 0–100, how much of the refresh interval is left (for the Progress bar). */
  percent: number;
  /** The token itself has expired (e.g. refresh failed while offline). */
  expired: boolean;
  /** Milliseconds until the next refresh should be requested. */
  refreshInMs: number;
}

export function qrCountdown(token: Pick<PersonalQrToken, "serverNow" | "expiresAt" | "refreshSeconds">, phoneNow: number, offsetMs: number): QrCountdown {
  const now = phoneNow + offsetMs; // server time
  const intervalMs = Math.max(1, token.refreshSeconds) * 1000;
  const refreshAt = Math.min(token.serverNow + intervalMs, token.expiresAt);
  const remaining = Math.max(0, refreshAt - now);
  return {
    secondsLeft: Math.ceil(remaining / 1000),
    percent: Math.max(0, Math.min(100, (remaining / intervalMs) * 100)),
    expired: now >= token.expiresAt,
    refreshInMs: remaining,
  };
}

/** Codes after which refreshing is pointless until the admin acts. */
export const QR_FATAL_CODES = new Set(["ACCOUNT_NOT_ACTIVE", "DEVICE_MISMATCH", "DEVICE_NOT_BOUND", "AUTH_REQUIRED", "FORBIDDEN"]);

/** Retry delay after a failed refresh: 5 s, 10 s, 20 s … capped at 60 s. */
export function retryDelayMs(failures: number): number {
  return Math.min(60_000, 5_000 * 2 ** Math.max(0, failures - 1));
}
