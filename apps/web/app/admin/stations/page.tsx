import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { requestTime } from "@/components/monitoring/health";
import type { KioskAccount } from "@/components/setup/station-form-dialog";
import { NewStationButton, StationsTable, type StationRow } from "@/components/setup/stations-table";
import { ErrorState, TableSkeleton } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { saveStation } from "./actions";

export const metadata: Metadata = { title: "Stations & Kiosks" };

export default function StationsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Stations & Kiosks"
            description="Kiosk locations, geofence radius and the kiosk account signed in on each tablet."
          />
          <TableSkeleton rows={3} />
        </>
      }
    >
      <StationsData />
    </Suspense>
  );
}

async function StationsData() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const [stationsRes, kiosksRes, settingsRes] = await Promise.all([
    supabase
      .from("stations")
      .select("*, kiosk:profiles!stations_kiosk_user_id_fkey(full_name, email)")
      .order("name"),
    supabase.from("profiles").select("id, full_name, email, status").eq("role", "kiosk").order("full_name"),
    supabase.from("app_settings").select("geofence_radius_m, heartbeat_interval_seconds").eq("id", 1).maybeSingle(),
  ]);
  const nowMs = requestTime();

  const header = (actions?: ReactNode) => (
    <PageHeader
      title="Stations & Kiosks"
      description="Kiosk locations, geofence radius and the kiosk account signed in on each tablet."
      actions={actions}
    />
  );

  if (stationsRes.error || kiosksRes.error || settingsRes.error) {
    return (
      <>
        {header()}
        <ErrorState message="Stations could not be loaded. Please refresh the page." />
      </>
    );
  }

  const defaultRadiusM = settingsRes.data?.geofence_radius_m ?? 100;
  const heartbeatIntervalSeconds = settingsRes.data?.heartbeat_interval_seconds ?? 60;
  const rows: StationRow[] = stationsRes.data.map((s) => ({
    id: s.id,
    values: {
      name: s.name,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      radiusM: s.radius_m,
      isActive: s.is_active,
      kioskUserId: s.kiosk_user_id,
    },
    isOnline: s.is_online,
    lastSeenAt: s.last_seen_at,
    kioskName: s.kiosk?.full_name ?? null,
    kioskEmail: s.kiosk?.email ?? null,
  }));
  const kioskAccounts: KioskAccount[] = kiosksRes.data
    .filter((k) => k.status === "active" || rows.some((r) => r.values.kioskUserId === k.id))
    .map((k) => ({ id: k.id, name: k.full_name, email: k.email, linkedStation: null }));

  return (
    <>
      {header(
        <NewStationButton
          rows={rows}
          kioskAccounts={kioskAccounts}
          defaultRadiusM={defaultRadiusM}
          saveAction={saveStation}
        />,
      )}
      <StationsTable
        rows={rows}
        kioskAccounts={kioskAccounts}
        defaultRadiusM={defaultRadiusM}
        heartbeatIntervalSeconds={heartbeatIntervalSeconds}
        nowMs={nowMs}
        saveAction={saveStation}
      />
    </>
  );
}
