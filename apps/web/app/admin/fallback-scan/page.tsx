import { errorMessage } from "@bhw/types";
import { MapPinOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FallbackScanner } from "@/components/attendance/fallback-scanner";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fallback Scan" };

export default async function FallbackScanPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const [stationsRes, employeesRes] = await Promise.all([
    supabase.from("stations").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, bhw_id_number, status")
      .eq("role", "employee")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const header = (
    <PageHeader
      title="Fallback Scan"
      description="Scan an employee's personal QR from the BHW app when the kiosk scan is not possible."
    />
  );

  if (stationsRes.error || employeesRes.error) {
    console.error("fallback scan page query failed", stationsRes.error ?? employeesRes.error);
    return (
      <>
        {header}
        <ErrorState message={errorMessage("INTERNAL_ERROR", "en")} />
      </>
    );
  }

  if (stationsRes.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={MapPinOffIcon}
          title="No active station"
          description="A fallback scan is saved for a station. Add or activate a station first."
          action={
            <Button asChild variant="outline" className="h-11">
              <Link href="/admin/stations">Go to Stations &amp; Kiosks</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <FallbackScanner stations={stationsRes.data} employees={employeesRes.data} today={manilaToday()} />
    </>
  );
}
