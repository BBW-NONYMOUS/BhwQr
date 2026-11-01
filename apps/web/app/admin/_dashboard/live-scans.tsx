import { manilaDayStart, toLiveScans, type LiveDirectory, type RawLiveScan } from "@/components/dashboard/dashboard-data";
import { RetryButton } from "@/components/dashboard/refresh-controls";
import { ErrorState } from "@/components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fromDbError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

import { LiveScanList } from "./live-scan-list";

const LIMIT = 20;

/** Last 20 successful scans of the Manila day, with time-in/out derived from attendance_records. */
async function loadLiveScans(workDate: string) {
  const supabase = await createClient();
  const { data: scans, error } = await supabase
    .from("scan_attempts")
    .select(
      "id, created_at, employee:profiles!scan_attempts_employee_id_fkey(full_name, bhw_id_number), station:stations!scan_attempts_station_id_fkey(name)",
    )
    .eq("success", true)
    .gte("created_at", manilaDayStart(workDate))
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) return { data: null, error: fromDbError(error).message ?? "Live scans could not be loaded." };
  if (!scans || scans.length === 0) return { data: [], error: null };

  const ids = scans.map((s) => s.id).join(",");
  const { data: records, error: recError } = await supabase
    .from("attendance_records")
    .select("time_in_scan_id, time_out_scan_id")
    .eq("work_date", workDate)
    .or(`time_in_scan_id.in.(${ids}),time_out_scan_id.in.(${ids})`);
  if (recError) return { data: null, error: fromDbError(recError).message ?? "Live scans could not be loaded." };

  return { data: toLiveScans(scans satisfies RawLiveScan[], records ?? []), error: null };
}

/** Employee and station names so Realtime changes can be shown before the server refresh. */
async function loadDirectory(): Promise<LiveDirectory> {
  const supabase = await createClient();
  const [{ data: employees }, { data: stations }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, bhw_id_number").eq("role", "employee").eq("status", "active"),
    supabase.from("stations").select("id, name"),
  ]);
  return {
    employees: Object.fromEntries((employees ?? []).map((e) => [e.id, { name: e.full_name, bhwIdNumber: e.bhw_id_number }])),
    stations: Object.fromEntries((stations ?? []).map((s) => [s.id, s.name])),
  };
}

export async function LiveScans({ workDate, className }: { workDate: string; className?: string }) {
  const [{ data, error }, directory] = await Promise.all([loadLiveScans(workDate), loadDirectory()]);
  return (
    <Card role="region" aria-labelledby="live-scans-heading" className={className}>
      <CardHeader>
        <CardTitle id="live-scans-heading" className="font-semibold">
          Live scans
        </CardTitle>
        <CardDescription>Latest {LIMIT} successful kiosk scans today.</CardDescription>
      </CardHeader>
      <CardContent>
        {error !== null ? (
          <ErrorState message={error} action={<RetryButton />} />
        ) : (
          <ScrollArea className="h-72 pr-3">
            <LiveScanList scans={data} directory={directory} />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
