"use client";

import { LogInIcon, LogOutIcon, ScanLineIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import {
  ATTENDANCE_CHANGE_EVENT,
  SCAN_ACTION_LABELS,
  liveScanFromRecord,
  mergeLiveScans,
  type LiveDirectory,
  type LiveScan,
  type RealtimeAttendanceRow,
} from "@/components/dashboard/dashboard-data";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Last successful kiosk scans of today. Items that arrive after a live refresh slide in; the
 * first render and reduced-motion users get no animation. aria-live announces new scans politely.
 */
export function LiveScanList({ scans: serverScans, directory }: { scans: LiveScan[]; directory: LiveDirectory }) {
  const reduceMotion = useReducedMotion();
  // Scans shown straight from Realtime (AC-05: on screen within 2 s); the server refresh that
  // follows replaces them with the authoritative rows (same scan id, so no duplicates).
  const [pending, setPending] = useState<LiveScan[]>([]);
  useEffect(() => {
    const onChange = (event: Event) => {
      const item = liveScanFromRecord((event as CustomEvent<RealtimeAttendanceRow>).detail, directory);
      if (item) setPending((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 20));
    };
    window.addEventListener(ATTENDANCE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(ATTENDANCE_CHANGE_EVENT, onChange);
  }, [directory]);
  const scans = mergeLiveScans(serverScans, pending);

  if (scans.length === 0) {
    return (
      <div aria-live="polite">
        <EmptyState
          icon={ScanLineIcon}
          title="No scans yet today"
          description="Successful kiosk scans appear here within seconds."
        />
      </div>
    );
  }

  return (
    <ol aria-live="polite" aria-relevant="additions" className="divide-y" aria-label="Latest successful scans">
      <AnimatePresence initial={false}>
        {scans.map((scan) => {
          const isOut = scan.action === "time_out";
          const ActionIcon = isOut ? LogOutIcon : LogInIcon;
          return (
            <motion.li
              key={scan.id}
              layout={reduceMotion ? false : "position"}
              initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="flex items-center gap-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  isOut ? "bg-muted text-muted-foreground" : "bg-status-on-time text-status-on-time-foreground",
                )}
              >
                <ActionIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{scan.employeeName}</p>
                <p className="truncate text-xs text-muted-foreground">{scan.stationName ?? "Unknown station"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <time dateTime={scan.createdAt} className="text-sm tabular-nums">
                  {formatTime(scan.createdAt)}
                </time>
                <Badge variant={isOut ? "outline" : "secondary"} className="rounded-full text-[11px]">
                  {scan.action ? SCAN_ACTION_LABELS[scan.action] : "Scan"}
                </Badge>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
