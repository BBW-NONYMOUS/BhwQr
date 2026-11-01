"use client";

import { LogInIcon, LogOutIcon, ScanLineIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { KioskFeedItem } from "./kiosk-utils";
import type { KioskMessage } from "./use-kiosk-engine";

/** Last 10 successful scans at this station, newest first (first names only, privacy). */
export function KioskFeed({
  items,
  error,
}: {
  items: KioskFeedItem[] | null;
  error: KioskMessage | null;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="kiosk-feed-title" className="flex min-h-0 flex-1 flex-col gap-3">
      <h2 id="kiosk-feed-title" className="flex items-baseline gap-2 text-xl font-semibold">
        Recent scans
        <span className="text-base font-normal text-muted-foreground">Mga huling nag-scan</span>
      </h2>

      {error ? (
        <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-lg">
          {error.en}
          <span className="block text-base text-muted-foreground">{error.fil}</span>
        </p>
      ) : null}

      {items === null ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading recent scans">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <ol
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Recent scans"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
        >
          {items.length === 0 ? (
            <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <ScanLineIcon className="size-8" aria-hidden />
              <span className="text-lg">No scans yet</span>
              <span>Wala pang nag-scan</span>
            </li>
          ) : null}
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const Icon = item.action === "time_in" ? LogInIcon : LogOutIcon;
              return (
                <motion.li
                  key={item.key}
                  initial={reduceMotion ? false : { opacity: 0, y: -16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
                  className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3"
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full",
                      item.action === "time_in"
                        ? "bg-brand/15 text-brand"
                        : "bg-secondary text-secondary-foreground",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-2xl font-semibold">{item.firstName}</span>
                    <span className="text-base text-muted-foreground">
                      {item.actionLabel} · {item.actionLabelFil}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-2xl font-semibold tabular-nums">{item.time}</span>
                    {item.status ? <StatusBadge status={item.status} className="h-6 px-2.5 text-sm" /> : null}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}
