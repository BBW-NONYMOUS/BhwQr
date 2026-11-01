import type { Metadata } from "next";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/monitoring/auto-refresh";
import {
  AnomalyTable,
  OfflineBanner,
  ScanHealthTable,
  StationCards,
  type AnomalyRow,
  type StationHealthCard,
} from "@/components/monitoring/device-health-view";
import { classifyStation, groupFailures, requestTime } from "@/components/monitoring/health";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Device Health" };

const HOUR = 3_600_000;

export default function DeviceHealthPage() {
  return (
    <Suspense fallback={<DeviceHealthSkeleton />}>
      <DeviceHealthData />
    </Suspense>
  );
}

function Header({ renderedAt }: { renderedAt?: string }) {
  return (
    <PageHeader
      title="Device Health"
      description="Kiosk heartbeats, clock drift and scan failures. A kiosk is offline after 3 missed heartbeats."
      actions={renderedAt ? <AutoRefresh renderedAt={renderedAt} /> : null}
    />
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function DeviceHealthData() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const nowMs = requestTime();
  const since1h = new Date(nowMs - HOUR).toISOString();
  const since24h = new Date(nowMs - 24 * HOUR).toISOString();
  const since7d = new Date(nowMs - 7 * 24 * HOUR).toISOString();

  const [stationsRes, settingsRes, beatsRes, failuresRes, anomaliesRes] = await Promise.all([
    supabase.from("stations").select("id, name, is_active, is_online, last_seen_at").eq("is_active", true).order("name"),
    supabase.from("app_settings").select("heartbeat_interval_seconds").eq("id", 1).maybeSingle(),
    supabase
      .from("kiosk_heartbeats")
      .select("station_id, created_at")
      .gte("created_at", since1h)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("scan_attempts")
      .select("error_code, failure_reason, created_at")
      .eq("success", false)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("error_logs")
      .select("id, created_at, message, context, user:profiles!error_logs_user_id_fkey(full_name)")
      .eq("context->>kind", "scan_anomaly")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const renderedAt = new Date(nowMs).toISOString();
  if (stationsRes.error || settingsRes.error || beatsRes.error || failuresRes.error || anomaliesRes.error) {
    return (
      <>
        <Header renderedAt={renderedAt} />
        <ErrorState message="Device health could not be loaded. It will retry automatically every 30 seconds." />
      </>
    );
  }

  // Latest heartbeat per station (may be older than the 1-hour sparkline window).
  const latest = await Promise.all(
    stationsRes.data.map((s) =>
      supabase
        .from("kiosk_heartbeats")
        .select("app_version, clock_drift_ms, last_token_at")
        .eq("station_id", s.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );

  const interval = settingsRes.data?.heartbeat_interval_seconds ?? 60;
  const stations: StationHealthCard[] = stationsRes.data.map((s, i) => {
    const hb = latest[i]?.data ?? null;
    return {
      id: s.id,
      name: s.name,
      health: classifyStation(s, nowMs, interval),
      lastSeenAt: s.last_seen_at,
      appVersion: hb?.app_version ?? null,
      clockDriftMs: hb?.clock_drift_ms ?? null,
      lastTokenAt: hb?.last_token_at ?? null,
      recentBeats: beatsRes.data.filter((b) => b.station_id === s.id).map((b) => b.created_at),
    };
  });

  const anomalies: AnomalyRow[] = anomaliesRes.data.map((e) => {
    const ctx = asRecord(e.context);
    return {
      id: e.id,
      createdAt: e.created_at,
      employeeName: e.user?.full_name ?? null,
      message: e.message,
      lastCode: typeof ctx.last_code === "string" ? ctx.last_code : null,
      failures10min: typeof ctx.failures_10min === "number" ? ctx.failures_10min : null,
      mockedLocation: ctx.mocked_location === true,
    };
  });

  return (
    <>
      <Header renderedAt={renderedAt} />
      <div className="space-y-6">
        <OfflineBanner stations={stations} nowMs={nowMs} />
        <section aria-labelledby="kiosks-heading" className="space-y-3">
          <h2 id="kiosks-heading" className="text-lg font-semibold">
            Kiosks
          </h2>
          <StationCards stations={stations} nowMs={nowMs} heartbeatIntervalSeconds={interval} />
        </section>
        <div className="grid gap-6 xl:grid-cols-2">
          <ScanHealthTable groups={groupFailures(failuresRes.data)} total={failuresRes.data.length} />
          <AnomalyTable rows={anomalies} />
        </div>
      </div>
    </>
  );
}

function DeviceHealthSkeleton() {
  return (
    <>
      <Header />
      <div className="space-y-6" aria-busy="true" aria-label="Loading device health">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
