"use client";

import {
  errorMessage,
  heartbeatResponseSchema,
  issueQrResponseSchema,
  type ErrorSeverity,
} from "@bhw/types";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { reportClientError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/client";

import {
  errorCodeFromBody,
  isNetworkDbError,
  retryDelayMs,
  serverClockOffset,
  toFeedItems,
  type KioskFeedItem,
} from "./kiosk-utils";

const HEARTBEAT_MS = 60_000;
/**
 * Recent-scan feed refresh. The kiosk account cannot read attendance_records or scan_attempts
 * through RLS, so a Realtime postgres_changes subscription would never fire for it. Instead the
 * kiosk polls the SECURITY DEFINER RPC get_kiosk_feed (own station, 12 h window, first names
 * only) every 5 s: one tiny indexed query per kiosk, and a new scan shows within 5 s.
 */
const FEED_POLL_MS = 5_000;
const FEED_LIMIT = 10;

export interface KioskToken {
  content: string;
  /** server epoch ms */
  issuedAt: number;
  /** server epoch ms */
  expiresAt: number;
}

export interface KioskMessage {
  en: string;
  fil: string;
}

export interface KioskEngineState {
  token: KioskToken | null;
  /** Device-clock time when the next token will be requested (for the countdown bar). */
  nextRefreshAt: number | null;
  refreshMs: number;
  /** serverNow - Date.now(), from the latest server response; null until the first one. */
  offsetMs: number | null;
  stationName: string;
  /** Server refused to issue a token (inactive station, kiosk not linked, ...). */
  serverError: KioskMessage | null;
  /** True when the browser is offline or the last request could not reach the server. */
  offline: boolean;
  drift: { ms: number; warning: boolean } | null;
  feed: KioskFeedItem[] | null;
  feedError: KioskMessage | null;
}

function catalogMessage(code: string): KioskMessage {
  return { en: errorMessage(code, "en"), fil: errorMessage(code, "fil") };
}

/** Splits an Edge Function failure into "could not reach the server" vs "server said no". */
async function classifyFunctionError(error: unknown): Promise<{ network: boolean; code: string }> {
  if (error instanceof FunctionsHttpError) {
    let body: unknown = null;
    try {
      body = await (error.context as Response).json();
    } catch {
      body = null;
    }
    return { network: false, code: errorCodeFromBody(body) ?? "INTERNAL_ERROR" };
  }
  // FunctionsFetchError (no connection) and FunctionsRelayError (gateway could not reach the
  // function) are both treated as a lost connection; the next retry usually succeeds.
  return { network: true, code: "NETWORK_ERROR" };
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** navigator.onLine as React state; assumed online during server rendering. */
export function useBrowserOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Drives the kiosk (core flows 3 and 8): requests a signed QR token every refreshSeconds, sends a
 * heartbeat every 60 s (kiosk accounts only, not admin previews), polls the recent-scan feed,
 * keeps the server-clock offset, and recovers immediately when the connection returns (FR-118).
 * Every failure is reported to log-error with source "kiosk", once per failure streak.
 */
export function useKioskEngine({
  stationId,
  initialStationName,
  appVersion,
  preview,
}: {
  stationId: string;
  initialStationName: string;
  appVersion: string;
  preview: boolean;
}): KioskEngineState {
  const supabase = useMemo(() => createClient(), []);
  const browserOnline = useBrowserOnline();

  const [token, setToken] = useState<KioskToken | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshMs, setRefreshMs] = useState(15_000);
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [stationName, setStationName] = useState(initialStationName);
  const [serverError, setServerError] = useState<KioskMessage | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [drift, setDrift] = useState<KioskEngineState["drift"]>(null);
  const [feed, setFeed] = useState<KioskFeedItem[] | null>(null);
  const [feedError, setFeedError] = useState<KioskMessage | null>(null);

  useEffect(() => {
    let disposed = false;
    let tokenTimer: number | undefined;
    let tokenInFlight = false;
    let tokenFailures = 0;
    let heartbeatFailures = 0;
    let feedFailures = 0;
    let lastTokenAt: number | null = null;
    let offlineSince: number | null = navigator.onLine ? null : Date.now();

    const report = (
      error: unknown,
      context: Record<string, unknown>,
      severity: ErrorSeverity = "error",
    ) => {
      // Reporting needs the network too; while offline the outage is reported on reconnect.
      if (!navigator.onLine) return;
      void reportClientError(error, { stationId, appVersion, ...context }, "kiosk", severity);
    };

    const markReachable = () => {
      if (!disposed) setConnectionLost(false);
    };
    const markUnreachable = () => {
      if (offlineSince === null) offlineSince = Date.now();
      if (!disposed) setConnectionLost(true);
    };

    const scheduleToken = (delay: number) => {
      window.clearTimeout(tokenTimer);
      tokenTimer = window.setTimeout(() => void requestToken(), delay);
    };

    async function requestToken(): Promise<void> {
      if (disposed || tokenInFlight) return;
      tokenInFlight = true;
      window.clearTimeout(tokenTimer);
      try {
        const { data, error } = await supabase.functions.invoke("issue-qr-token", {
          body: { stationId },
        });
        const receivedAt = Date.now();
        if (disposed) return;

        if (error) {
          tokenFailures += 1;
          const { network, code } = await classifyFunctionError(error);
          if (disposed) return;
          if (network) {
            markUnreachable();
          } else {
            markReachable();
            setServerError(catalogMessage(code));
          }
          if (tokenFailures === 1) report(error, { op: "issue-qr-token", code });
          scheduleToken(retryDelayMs(tokenFailures));
          return;
        }

        const parsed = issueQrResponseSchema.safeParse(data);
        if (!parsed.success) {
          tokenFailures += 1;
          markReachable();
          setServerError(catalogMessage("INTERNAL_ERROR"));
          if (tokenFailures === 1) {
            report(new Error("issue-qr-token returned an unexpected response"), {
              op: "issue-qr-token",
              issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join(".")),
            });
          }
          scheduleToken(retryDelayMs(tokenFailures));
          return;
        }

        tokenFailures = 0;
        const res = parsed.data;
        const interval = Math.max(5, res.refreshSeconds) * 1000;
        lastTokenAt = res.issuedAt;
        markReachable();
        setServerError(null);
        setOffsetMs(serverClockOffset(res.serverNow, receivedAt));
        setStationName(res.stationName);
        setRefreshMs(interval);
        setToken({ content: res.content, issuedAt: res.issuedAt, expiresAt: res.expiresAt });
        setNextRefreshAt(receivedAt + interval);
        scheduleToken(interval);
      } catch (e) {
        tokenFailures += 1;
        markUnreachable();
        if (tokenFailures === 1) report(e, { op: "issue-qr-token" });
        scheduleToken(retryDelayMs(tokenFailures));
      } finally {
        tokenInFlight = false;
      }
    }

    async function sendHeartbeat(): Promise<void> {
      if (disposed || preview) return;
      try {
        const { data, error } = await supabase.functions.invoke("kiosk-heartbeat", {
          body: { stationId, appVersion, clientNow: Date.now(), lastTokenAt },
        });
        const receivedAt = Date.now();
        if (disposed) return;
        if (error) {
          heartbeatFailures += 1;
          const { network, code } = await classifyFunctionError(error);
          if (network) markUnreachable();
          if (heartbeatFailures === 1) report(error, { op: "kiosk-heartbeat", code });
          return;
        }
        const parsed = heartbeatResponseSchema.safeParse(data);
        if (!parsed.success) {
          heartbeatFailures += 1;
          if (heartbeatFailures === 1) {
            report(new Error("kiosk-heartbeat returned an unexpected response"), {
              op: "kiosk-heartbeat",
            });
          }
          return;
        }
        heartbeatFailures = 0;
        markReachable();
        setOffsetMs(serverClockOffset(parsed.data.serverNow, receivedAt));
        setDrift({ ms: parsed.data.clockDriftMs, warning: parsed.data.driftWarning });
      } catch (e) {
        heartbeatFailures += 1;
        markUnreachable();
        if (heartbeatFailures === 1) report(e, { op: "kiosk-heartbeat" });
      }
    }

    async function loadFeed(): Promise<void> {
      if (disposed || document.visibilityState === "hidden") return;
      try {
        const { data, error } = await supabase.rpc("get_kiosk_feed", {
          p_station_id: stationId,
          p_limit: FEED_LIMIT,
        });
        if (disposed) return;
        if (error) {
          feedFailures += 1;
          if (isNetworkDbError(error)) {
            markUnreachable();
          } else {
            setFeedError(catalogMessage(error.message.trim() || "INTERNAL_ERROR"));
            if (feedFailures === 1) report(new Error(error.message), { op: "get_kiosk_feed", code: error.code });
          }
          return;
        }
        feedFailures = 0;
        markReachable();
        setFeedError(null);
        setFeed(toFeedItems(data ?? [], FEED_LIMIT));
      } catch (e) {
        feedFailures += 1;
        markUnreachable();
        if (feedFailures === 1) report(e, { op: "get_kiosk_feed" });
      }
    }

    const onOnline = () => {
      // FR-118: on reconnect fetch a fresh token and send a heartbeat right away.
      if (offlineSince !== null) {
        const offlineSeconds = Math.round((Date.now() - offlineSince) / 1000);
        offlineSince = null;
        report(new Error("Kiosk connection restored"), { op: "reconnect", offlineSeconds }, "warning");
      }
      void requestToken();
      void sendHeartbeat();
      void loadFeed();
    };
    const onOffline = () => {
      if (offlineSince === null) offlineSince = Date.now();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadFeed();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const heartbeatTimer = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_MS);
    const feedTimer = window.setInterval(() => void loadFeed(), FEED_POLL_MS);

    void requestToken();
    void sendHeartbeat();
    void loadFeed();

    return () => {
      disposed = true;
      window.clearTimeout(tokenTimer);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(feedTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, stationId, appVersion, preview]);

  return {
    token,
    nextRefreshAt,
    refreshMs,
    offsetMs,
    stationName,
    serverError,
    offline: !browserOnline || connectionLost,
    drift,
    feed,
    feedError,
  };
}
