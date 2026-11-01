import { MonitorOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { KioskNotice } from "@/components/kiosk/kiosk-notice";
import { KioskScreen } from "@/components/kiosk/kiosk-screen";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import packageJson from "@/package.json";

export const metadata: Metadata = { title: "Kiosk QR" };

/** Sent with every heartbeat so Device Health shows which build each kiosk runs. */
const APP_VERSION = `web-${packageJson.version}`;

export default async function KioskStationPage({ params }: PageProps<"/kiosk/[stationId]">) {
  const { stationId } = await params;
  const profile = await requireProfile(["kiosk", "admin"]);
  if (!z.uuid().safeParse(stationId).success) notFound();

  // RLS: a kiosk account sees only the station linked to it; admins see every station.
  const supabase = await createClient();
  const { data: station } = await supabase
    .from("stations")
    .select("id, name, is_active")
    .eq("id", stationId)
    .maybeSingle();

  const back =
    profile.role === "admin" ? (
      <Button asChild size="lg" variant="outline" className="h-12 px-6 text-lg">
        <Link href="/kiosk">Choose another station</Link>
      </Button>
    ) : null;

  if (!station) {
    return (
      <KioskNotice
        icon={MonitorOffIcon}
        title="This kiosk is not linked to this station"
        titleFil="Hindi naka-link ang kiosk na ito sa istasyong ito"
        description="Ask the administrator to link this kiosk account in Admin → Stations & Kiosks."
      >
        {back}
      </KioskNotice>
    );
  }

  if (!station.is_active) {
    return (
      <KioskNotice
        icon={MonitorOffIcon}
        title={`${station.name} is inactive`}
        titleFil="Hindi aktibo ang istasyong ito"
        description="QR codes are not issued for inactive stations. An administrator can reactivate it in Stations & Kiosks."
      >
        {back}
      </KioskNotice>
    );
  }

  return (
    <KioskScreen
      stationId={station.id}
      stationName={station.name}
      appVersion={APP_VERSION}
      preview={profile.role === "admin"}
    />
  );
}
