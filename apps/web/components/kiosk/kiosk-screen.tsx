"use client";

import { ClockAlertIcon, MaximizeIcon, MinimizeIcon, SmartphoneIcon, WifiIcon, WifiOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { KioskFeed } from "./kiosk-feed";
import { KioskQrCard } from "./kiosk-qr-card";
import { formatDrift, manilaClockParts, serverTimeFrom } from "./kiosk-utils";
import { useFullscreen, useNow, useWakeLock } from "./use-kiosk-device";
import { useKioskEngine } from "./use-kiosk-engine";

/**
 * Full-screen kiosk (core flow 3, screen "/kiosk/[stationId]"): rotating QR, countdown, Manila
 * clock from server time, recent scans, connection status, heartbeat, wake lock and fullscreen.
 */
export function KioskScreen({
  stationId,
  stationName: initialStationName,
  appVersion,
  preview,
}: {
  stationId: string;
  stationName: string;
  appVersion: string;
  /** Admin preview: tokens are issued but no heartbeat is sent (only kiosk accounts send them). */
  preview: boolean;
}) {
  const engine = useKioskEngine({ stationId, initialStationName, appVersion, preview });
  const now = useNow(250);
  const fullscreen = useFullscreen();
  useWakeLock();

  const serverNow = engine.offsetMs !== null && now > 0 ? serverTimeFrom(engine.offsetMs, now) : null;
  const clock = serverNow !== null ? manilaClockParts(serverNow) : null;
  const tokenValid = engine.token !== null && serverNow !== null && serverNow < engine.token.expiresAt;

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      {engine.offline ? (
        <div
          role="alert"
          className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-destructive px-6 py-4 text-center text-destructive-foreground"
        >
          <WifiOffIcon className="size-7 shrink-0" aria-hidden />
          <p className="text-2xl font-bold">Offline – scans cannot be recorded</p>
          <p className="text-xl">Walang koneksyon – hindi maitatala ang mga scan</p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5 lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-brand uppercase">
            BHW QR Attendance · Barangay Kalawag II
          </p>
          <h1 className="truncate text-3xl font-bold tracking-tight lg:text-4xl">{engine.stationName}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right" aria-label="Current time in Manila">
            {clock ? (
              <>
                <time
                  dateTime={new Date(serverNow ?? 0).toISOString()}
                  className="block text-5xl font-bold tabular-nums lg:text-6xl"
                >
                  {clock.time}
                </time>
                <p className="text-lg text-muted-foreground">
                  {clock.weekday} ({clock.weekdayFil}), {clock.date}
                </p>
              </>
            ) : (
              <>
                <span className="block text-5xl font-bold text-muted-foreground tabular-nums lg:text-6xl">
                  --:--:--
                </span>
                <p className="text-lg text-muted-foreground">Syncing time with server…</p>
              </>
            )}
          </div>
          {fullscreen.supported ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12"
              onClick={fullscreen.toggle}
              aria-pressed={fullscreen.active}
              aria-keyshortcuts="F"
              aria-label={fullscreen.active ? "Exit full screen (F)" : "Enter full screen (F)"}
              title={fullscreen.active ? "Exit full screen (F)" : "Enter full screen (F)"}
            >
              {fullscreen.active ? <MinimizeIcon className="size-6" /> : <MaximizeIcon className="size-6" />}
            </Button>
          ) : null}
        </div>
      </header>

      <main className="grid flex-1 gap-8 px-6 py-6 lg:grid-cols-[auto_minmax(20rem,1fr)] lg:px-10">
        <KioskQrCard
          token={engine.token}
          valid={tokenValid}
          stationName={engine.stationName}
          refreshMs={engine.refreshMs}
          nextRefreshAt={engine.nextRefreshAt}
          now={now}
          serverError={engine.serverError}
          offline={engine.offline}
        />

        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex items-start gap-4 rounded-2xl border bg-card p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <SmartphoneIcon className="size-6" aria-hidden />
            </span>
            <div className="space-y-2">
              <p className="text-2xl leading-snug font-semibold">
                Open the BHW Attendance app and scan this code
              </p>
              <p lang="fil" className="text-xl leading-snug text-muted-foreground">
                Buksan ang BHW Attendance app at i-scan ang code na ito
              </p>
            </div>
          </div>

          <KioskFeed items={engine.feed} error={engine.feedError} />
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-6 pb-5 text-sm text-muted-foreground lg:px-10">
        <div role="status" aria-live="polite" className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-base",
              engine.offline ? "border-destructive/50 text-destructive" : "text-foreground",
            )}
          >
            {engine.offline ? (
              <WifiOffIcon className="size-4" aria-hidden />
            ) : (
              <WifiIcon className="size-4 text-brand" aria-hidden />
            )}
            {engine.offline ? "Offline · Walang koneksyon" : "Online · Konektado"}
          </span>
          {engine.drift?.warning ? (
            <Badge
              className="h-8 rounded-full bg-status-late px-3 text-sm text-status-late-foreground"
              title="This device's clock differs from the server. The kiosk still uses server time; fix the tablet's date and time settings."
            >
              <ClockAlertIcon aria-hidden />
              Clock drift {formatDrift(engine.drift.ms)}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {preview ? (
            <Badge variant="outline" className="h-7 rounded-full px-3 text-sm">
              Admin preview – heartbeats are not sent
            </Badge>
          ) : null}
          <span className="tabular-nums">{appVersion}</span>
        </div>
      </footer>
    </div>
  );
}
