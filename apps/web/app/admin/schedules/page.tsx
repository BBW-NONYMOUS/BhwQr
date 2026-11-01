import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { RecomputeButton } from "@/components/setup/recompute-dialog";
import { countAssignments, normalizeWorkDays, toHhmm } from "@/components/setup/schedule";
import { NewScheduleButton, SchedulesTable, type ScheduleRow } from "@/components/setup/schedules-table";
import { ErrorState, TableSkeleton } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { deleteSchedule, recomputeFromSchedules, saveSchedule } from "./actions";

export const metadata: Metadata = { title: "Schedules" };

export default function SchedulesPage() {
  return (
    <>
      <PageHeader
        title="Schedules"
        description="Work days, office hours, lunch break and grace period used to compute late, undertime and absences."
        actions={
          <Suspense fallback={null}>
            <HeaderActions />
          </Suspense>
        }
      />
      <Alert className="mb-6">
        <InfoIcon aria-hidden />
        <AlertTitle>Schedule changes apply to new scans only</AlertTitle>
        <AlertDescription>
          Past attendance keeps the status computed when it was recorded. To apply a change to earlier dates, use
          “Recompute statuses” for the affected date range.
        </AlertDescription>
      </Alert>
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <SchedulesData />
      </Suspense>
    </>
  );
}

async function HeaderActions() {
  await requireProfile(["admin"]);
  const today = manilaToday();
  return (
    <>
      <RecomputeButton
        action={recomputeFromSchedules}
        defaultRange={{ from: `${today.slice(0, 8)}01`, to: today }}
        description="Recalculates statuses for every employee in the range with the schedules in effect now. Use it after editing a schedule that was already in use."
      />
      <NewScheduleButton saveAction={saveSchedule} />
    </>
  );
}

async function SchedulesData() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("*, employee_schedules(employee_id, effective_from, effective_to)")
    .order("name");

  if (error) {
    return <ErrorState message="Schedules could not be loaded. Please refresh the page." />;
  }

  const today = manilaToday();
  const rows: ScheduleRow[] = data.map((s) => {
    const counts = countAssignments(s.employee_schedules, today);
    return {
      id: s.id,
      values: {
        name: s.name,
        workDays: normalizeWorkDays(s.work_days),
        startTime: toHhmm(s.start_time),
        endTime: toHhmm(s.end_time),
        breakStart: toHhmm(s.break_start),
        breakEnd: toHhmm(s.break_end),
        graceMinutes: s.grace_minutes,
      },
      currentEmployees: counts.current,
      everEmployees: counts.ever,
    };
  });

  return <SchedulesTable rows={rows} saveAction={saveSchedule} deleteAction={deleteSchedule} />;
}
