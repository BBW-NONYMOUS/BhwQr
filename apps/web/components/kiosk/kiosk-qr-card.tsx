"use client";

import { AlertTriangleIcon, LoaderCircleIcon, WifiOffIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";

import { Progress } from "@/components/ui/progress";

import { BorderBeam } from "./border-beam";
import { countdownPercent, countdownSeconds } from "./kiosk-utils";
import type { KioskMessage, KioskToken } from "./use-kiosk-engine";

/**
 * The rotating kiosk QR (core flow 3) in a card with a border beam, cross-fading on every refresh,
 * plus the countdown bar to the next token. The QR is hidden once its token has expired (the
 * server would reject it anyway), e.g. after a long outage.
 */
export function KioskQrCard({
  token,
  valid,
  stationName,
  refreshMs,
  nextRefreshAt,
  now,
  serverError,
  offline,
}: {
  token: KioskToken | null;
  /** Token exists and has not expired by server time. */
  valid: boolean;
  stationName: string;
  refreshMs: number;
  nextRefreshAt: number | null;
  now: number;
  serverError: KioskMessage | null;
  offline: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const showQr = valid && token !== null;
  const seconds = nextRefreshAt !== null && now > 0 ? countdownSeconds(nextRefreshAt, now) : null;
  const percent = nextRefreshAt !== null && now > 0 ? countdownPercent(nextRefreshAt, refreshMs, now) : 0;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative rounded-3xl border bg-card p-3 shadow-lg sm:p-5">
        <BorderBeam size={180} duration={10} borderWidth={3} />
        <div
          role="img"
          aria-label={
            showQr
              ? `Attendance QR code for ${stationName}. A new code appears every ${Math.round(refreshMs / 1000)} seconds.`
              : "Attendance QR code is not available right now"
          }
          data-qr-issued-at={showQr ? token.issuedAt : undefined}
          data-qr-state={showQr ? "ready" : serverError ? "error" : offline ? "offline" : "loading"}
          className="relative grid size-[min(62svh,76vw)] place-items-stretch overflow-hidden rounded-2xl bg-muted lg:size-[min(68svh,52vw)]"
        >
          <AnimatePresence initial={false}>
            {showQr ? (
              <motion.div
                key={token.issuedAt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeInOut" }}
                // White background and quiet zone are required for reliable scanning.
                className="[grid-area:1/1] bg-white"
              >
                <QRCodeSVG
                  value={token.content}
                  level="M"
                  marginSize={4}
                  size={512}
                  className="block size-full"
                  aria-hidden
                />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
                className="flex flex-col items-center justify-center gap-3 p-6 text-center [grid-area:1/1]"
              >
                {serverError ? (
                  <>
                    <AlertTriangleIcon className="size-12 text-destructive" aria-hidden />
                    <p className="text-xl font-semibold">{serverError.en}</p>
                    <p className="text-lg text-muted-foreground">{serverError.fil}</p>
                  </>
                ) : offline ? (
                  <>
                    <WifiOffIcon className="size-12 text-destructive" aria-hidden />
                    <p className="text-xl font-semibold">QR code unavailable – reconnecting…</p>
                    <p className="text-lg text-muted-foreground">
                      Hindi available ang QR code – kumokonekta muli…
                    </p>
                  </>
                ) : (
                  <>
                    <LoaderCircleIcon className="size-12 animate-spin text-muted-foreground" aria-hidden />
                    <p className="text-xl font-semibold">Preparing QR code…</p>
                    <p className="text-lg text-muted-foreground">Inihahanda ang QR code…</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex w-full max-w-[min(62svh,76vw)] flex-col gap-2 lg:max-w-[min(68svh,52vw)]">
        <Progress
          value={showQr ? percent : 0}
          aria-label="Time until the next QR code"
          getValueLabel={() => (seconds === null ? "Waiting for the first QR code" : `${seconds} seconds`)}
          className="h-3 *:bg-brand *:duration-300 *:ease-linear"
        />
        <p className="flex justify-between gap-4 text-base text-muted-foreground tabular-nums">
          <span>{seconds === null || !showQr ? "New code soon" : `New code in ${seconds} s`}</span>
          <span>{seconds === null || !showQr ? "Bagong code maya-maya" : `Bagong code sa ${seconds} s`}</span>
        </p>
      </div>
    </div>
  );
}
