"use client";

import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ATTENDANCE_CHANGE_EVENT } from "@/components/dashboard/dashboard-data";
import { reportClientError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LiveState = "connecting" | "live" | "offline";

const LABELS: Record<LiveState, { text: string; aria: string }> = {
  connecting: { text: "Connecting…", aria: "Live updates connecting" },
  live: { text: "Live", aria: "Live updates on: the dashboard refreshes when scans arrive" },
  offline: { text: "Offline", aria: "Live updates disconnected: reload the page to reconnect" },
};

/** Debounce so a burst of events (scan insert + record upsert) causes one refresh. */
const DEBOUNCE_MS = 300;

/**
 * Realtime bridge for the admin dashboard (AC: updates within 2 s of a scan). Subscribes to
 * postgres_changes on today's attendance_records, successful scan_attempts inserts, station
 * updates (online/offline) and correction requests, then re-renders the Server Components with
 * router.refresh(). RLS applies to Realtime, so only admins receive these rows.
 */
export function RealtimeRefresh({ workDate }: { workDate: string }) {
  const router = useRouter();
  const [state, setState] = useState<LiveState>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribedBefore = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    // Realtime must join with the admin's JWT, not the anon key: RLS filters postgres_changes, so a
    // channel joined before the cookie session is loaded would silently receive no admin rows.
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = subscribe();
    });

    const subscribe = () => supabase
      .channel(`admin-dashboard:${workDate}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `work_date=eq.${workDate}` },
        (payload) => {
          // Lets the live list show the scan immediately, before the debounced server refresh.
          if (payload.new && "employee_id" in payload.new) {
            window.dispatchEvent(new CustomEvent(ATTENDANCE_CHANGE_EVENT, { detail: payload.new }));
          }
          refresh();
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_attempts", filter: "success=eq.true" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "correction_requests" }, refresh)
      .subscribe((status, err) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          setState("live");
          // After a reconnect, catch up on anything missed while the socket was down.
          if (subscribedBefore) refresh();
          subscribedBefore = true;
          return;
        }
        setState("offline");
        if (err) void reportClientError(err, { feature: "admin-dashboard-realtime", status }, "web", "warning");
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, workDate]);

  const label = LABELS[state];
  return (
    <span
      role="status"
      aria-label={label.aria}
      title={label.aria}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
    >
      <span className="relative flex size-2" aria-hidden="true">
        {state === "live" ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", state === "live" ? "bg-brand" : "bg-muted-foreground")} />
      </span>
      <span className={cn(state !== "live" && "text-muted-foreground")}>{label.text}</span>
    </span>
  );
}
