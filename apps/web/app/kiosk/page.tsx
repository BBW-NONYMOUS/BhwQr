import { LogOutIcon, MonitorIcon, MonitorOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
import { KioskNotice } from "@/components/kiosk/kiosk-notice";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kiosk" };

/**
 * Kiosk entry (HOME_BY_ROLE.kiosk). A kiosk account goes straight to its station; an admin picks
 * a station to preview.
 */
export default async function KioskIndexPage() {
  const profile = await requireProfile(["kiosk", "admin"]);
  const supabase = await createClient();

  let query = supabase
    .from("stations")
    .select("id, name, is_active, is_online, last_seen_at")
    .order("name");
  if (profile.role === "kiosk") query = query.eq("kiosk_user_id", profile.id).eq("is_active", true);
  const { data: stations, error } = await query;

  const signOut = (
    <form action={signOutAction}>
      <Button type="submit" size="lg" variant="outline" className="h-12 px-6 text-lg">
        <LogOutIcon aria-hidden />
        Sign out
      </Button>
    </form>
  );

  if (error) {
    return (
      <KioskNotice
        icon={MonitorOffIcon}
        title="Stations could not be loaded"
        titleFil="Hindi ma-load ang mga istasyon"
        description="Check the internet connection and reload this page."
      >
        {signOut}
      </KioskNotice>
    );
  }

  if (profile.role === "kiosk" && stations.length === 1 && stations[0]) {
    redirect(`/kiosk/${stations[0].id}`);
  }

  if (stations.length === 0) {
    return (
      <KioskNotice
        icon={MonitorOffIcon}
        title={profile.role === "kiosk" ? "This kiosk account has no active station" : "No stations yet"}
        titleFil="Walang naka-link na aktibong istasyon"
        description={
          profile.role === "kiosk"
            ? "Ask the administrator to link this account to a station in Admin → Stations & Kiosks."
            : "Create a station in Admin → Stations & Kiosks first."
        }
      >
        {signOut}
      </KioskNotice>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 lg:py-12">
      <div className="space-y-1">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">BHW QR Attendance</p>
        <h1 className="text-3xl font-bold tracking-tight">Choose a kiosk station</h1>
        <p className="text-lg text-muted-foreground">
          {profile.role === "admin"
            ? "Open a station's QR screen as a preview. Heartbeats are only sent by kiosk accounts."
            : "Pumili ng istasyon para sa kiosk na ito."}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {stations.map((station) => (
          <li key={station.id}>
            <Link
              href={`/kiosk/${station.id}`}
              aria-disabled={!station.is_active}
              className={cn(
                "flex min-h-16 items-center gap-4 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                !station.is_active && "opacity-60",
              )}
            >
              <MonitorIcon className="size-6 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-semibold">{station.name}</span>
                <span className="text-sm text-muted-foreground">
                  {station.is_active ? (station.is_online ? "Online" : "Offline") : "Inactive"} · Last seen{" "}
                  {formatDateTime(station.last_seen_at)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div>{signOut}</div>
    </main>
  );
}
