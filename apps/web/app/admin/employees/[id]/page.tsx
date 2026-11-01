import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  FileTextIcon,
  LockIcon,
  SmartphoneIcon,
  UserCheckIcon,
} from "lucide-react";
import { z } from "zod";

import { EmployeeAttendanceTable, type AttendanceRow } from "@/components/employees/attendance-table";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import {
  EditProfileDialog,
  ResetDeviceButton,
  StatusActionButtons,
} from "@/components/employees/employee-actions";
import {
  ROLE_LABELS,
  assignmentState,
  availableStatusActions,
  canAssignSchedule,
  canResetDevice,
  formatClock,
  formatWorkDays,
  shiftIsoDate,
  type AssignmentState,
} from "@/components/employees/employee-helpers";
import { ProfileStatusBadge } from "@/components/employees/profile-status-badge";
import { ScheduleDialog, type ScheduleOption } from "@/components/employees/schedule-dialog";
import { signProfilePhotos } from "@/components/employees/server-helpers";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireProfile } from "@/lib/auth/session";
import { formatDate, formatDateTime, manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Employee" };

const ASSIGNMENT_LABELS: Record<AssignmentState, string> = {
  current: "In effect",
  upcoming: "Upcoming",
  ended: "Ended",
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export default async function EmployeeDetailPage({ params }: PageProps<"/admin/employees/[id]">) {
  const me = await requireProfile(["admin"]);
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return (
      <ErrorState
        message="This profile could not be loaded. Check your connection and try again."
        action={
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/admin/employees/${id}`}>Try again</Link>
          </Button>
        }
      />
    );
  }
  if (!profile) notFound();

  const isEmployee = profile.role === "employee";
  const today = manilaToday();
  const from = shiftIsoDate(today, -29);

  const [privateRes, approverRes, photos, devicesRes, assignmentsRes, schedulesRes, historyRes] = await Promise.all([
    supabase.rpc("get_profile_private", { p_profile_id: profile.id }),
    profile.approved_by
      ? supabase.from("profiles").select("full_name").eq("id", profile.approved_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    signProfilePhotos(supabase, [profile.photo_url]),
    isEmployee
      ? supabase
          .from("devices")
          .select("id, platform, model, bound_at, revoked_at")
          .eq("employee_id", profile.id)
          .order("bound_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isEmployee
      ? supabase
          .from("employee_schedules")
          .select("effective_from, effective_to, created_at, schedules(id, name, work_days, start_time, end_time, grace_minutes)")
          .eq("employee_id", profile.id)
          .order("effective_from", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isEmployee
      ? supabase
          .from("schedules")
          .select("id, name, work_days, start_time, end_time, grace_minutes")
          .order("name")
      : Promise.resolve({ data: [], error: null }),
    isEmployee
      ? supabase.rpc("get_employee_history", { p_employee_id: profile.id, p_from: from, p_to: today })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const privateData = privateRes.data?.[0];
  const photoUrl = profile.photo_url ? (photos.get(profile.photo_url) ?? null) : null;
  const devices = devicesRes.data ?? [];
  const activeDevice = devices.find((d) => d.revoked_at === null) ?? null;
  const assignments = assignmentsRes.data ?? [];
  const currentAssignment = assignments.find((a) => assignmentState(a, today) === "current") ?? null;
  const scheduleOptions: ScheduleOption[] = (schedulesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    summary: `${formatWorkDays(s.work_days)} · ${formatClock(s.start_time)}–${formatClock(s.end_time)} · ${s.grace_minutes} min grace`,
  }));
  const attendance: AttendanceRow[] = (historyRes.data ?? []).map((r) => ({
    id: r.id,
    work_date: r.work_date,
    time_in: r.time_in,
    time_out: r.time_out,
    status: r.status,
    minutes_late: r.minutes_late ?? 0,
    undertime_minutes: r.undertime_minutes ?? 0,
    method: r.method,
    station_name: r.station_name,
    pending_correction: r.pending_correction,
  }));

  const statusActions = availableStatusActions(profile, { isSelf: me.id === profile.id });
  const reviewedLabel = profile.status === "rejected" ? "Rejected by" : "Approved by";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 print:hidden">
        <Link href={isEmployee ? "/admin/employees" : "/admin/employees?tab=staff"}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Employees
        </Link>
      </Button>

      <PageHeader
        title={profile.full_name}
        description={isEmployee ? `BHW employee · ${profile.bhw_id_number ?? "No BHW ID"}` : ROLE_LABELS[profile.role]}
        actions={
          <>
            <EditProfileDialog
              employee={{
                id: profile.id,
                role: profile.role,
                full_name: profile.full_name,
                bhw_id_number: profile.bhw_id_number,
                area: profile.area,
              }}
            />
            {statusActions.includes("approve") ? (
              <Button asChild className="h-11">
                <Link href="/admin/approvals">
                  <UserCheckIcon data-icon="inline-start" aria-hidden />
                  Review in Pending Approvals
                </Link>
              </Button>
            ) : null}
            <StatusActionButtons
              employeeId={profile.id}
              employeeName={profile.full_name}
              actions={statusActions.filter((a) => a === "deactivate" || a === "reactivate")}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card (FR-12) */}
        <Card className="lg:row-span-2">
          <CardHeader className="flex flex-col items-center gap-3 text-center">
            <EmployeeAvatar name={profile.full_name} photoUrl={photoUrl} size="xl" />
            <div className="space-y-1">
              <CardTitle className="text-lg">{profile.full_name}</CardTitle>
              <CardDescription>{ROLE_LABELS[profile.role]}</CardDescription>
            </div>
            <ProfileStatusBadge status={profile.status} />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm">
              {isEmployee ? (
                <>
                  <Detail label="BHW ID number">{profile.bhw_id_number ?? "—"}</Detail>
                  <Detail label="Purok / area">{profile.area ?? "—"}</Detail>
                </>
              ) : null}
              <Detail label="Email">{profile.email}</Detail>
              {isEmployee ? (
                <>
                  <Separator />
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Contact number and address are encrypted at rest and owned by the employee. They update them
                    from their own profile in the app or at /me.
                  </p>
                  <Detail label="Contact number">
                    {privateRes.error ? (
                      <span className="text-destructive">Could not be decrypted</span>
                    ) : (
                      (privateData?.contact_number ?? "—")
                    )}
                  </Detail>
                  <Detail label="Address">
                    {privateRes.error ? (
                      <span className="text-destructive">Could not be decrypted</span>
                    ) : (
                      (privateData?.address ?? "—")
                    )}
                  </Detail>
                  <Separator />
                  <Detail label="Data Privacy consent">{formatDateTime(profile.consent_at)}</Detail>
                </>
              ) : null}
              <Detail label={isEmployee ? "Registered" : "Created"}>{formatDateTime(profile.created_at)}</Detail>
              {profile.approved_by || profile.approved_at ? (
                <Detail label={reviewedLabel}>
                  {approverRes.data?.full_name ?? "—"}
                  <span className="block text-xs text-muted-foreground">{formatDateTime(profile.approved_at)}</span>
                </Detail>
              ) : null}
              {profile.status === "rejected" && profile.rejection_reason ? (
                <Detail label="Rejection reason">{profile.rejection_reason}</Detail>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {isEmployee ? (
          <>
            {/* Device (FR-17, FR-32, FR-33) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SmartphoneIcon className="size-4" aria-hidden />
                  Registered phone
                </CardTitle>
                <CardDescription>One phone per employee. Resetting lets them register a new phone.</CardDescription>
                {canResetDevice(profile, activeDevice !== null) ? (
                  <CardAction>
                    <ResetDeviceButton employeeId={profile.id} employeeName={profile.full_name} />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {devicesRes.error ? (
                  <ErrorState message="The device history could not be loaded." />
                ) : activeDevice ? (
                  <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
                    <Detail label="Platform">
                      <span className="capitalize">{activeDevice.platform}</span>
                    </Detail>
                    <Detail label="Model">{activeDevice.model ?? "Unknown model"}</Detail>
                    <Detail label="Bound">{formatDateTime(activeDevice.bound_at)}</Detail>
                  </dl>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No phone is registered. The first phone this employee logs in with on the BHW app is bound
                    automatically.
                  </p>
                )}
                {devices.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <caption className="sr-only">Device history</caption>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Platform</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Bound</TableHead>
                          <TableHead>Reset</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {devices.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="capitalize">{d.platform}</TableCell>
                            <TableCell>{d.model ?? "—"}</TableCell>
                            <TableCell className="tabular-nums">{formatDateTime(d.bound_at)}</TableCell>
                            <TableCell className="tabular-nums">
                              {d.revoked_at ? (
                                formatDateTime(d.revoked_at)
                              ) : (
                                <Badge variant="secondary" className="rounded-full">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Schedule (FR-16, D-19) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClockIcon className="size-4" aria-hidden />
                  Work schedule
                </CardTitle>
                <CardDescription>
                  {currentAssignment?.schedules
                    ? `${currentAssignment.schedules.name}: ${formatWorkDays(currentAssignment.schedules.work_days)}, ${formatClock(currentAssignment.schedules.start_time)}–${formatClock(currentAssignment.schedules.end_time)}, ${currentAssignment.schedules.grace_minutes} min grace`
                    : "No schedule is in effect today, so attendance cannot be classified."}
                </CardDescription>
                {canAssignSchedule(profile) ? (
                  <CardAction>
                    <ScheduleDialog
                      purpose="assign"
                      employeeId={profile.id}
                      employeeName={profile.full_name}
                      schedules={scheduleOptions}
                      defaultEffectiveFrom={today}
                      trigger={
                        <Button variant="outline" className="h-11">
                          <CalendarPlusIcon data-icon="inline-start" aria-hidden />
                          Assign schedule
                        </Button>
                      }
                    />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent>
                {assignmentsRes.error ? (
                  <ErrorState message="The schedule history could not be loaded." />
                ) : assignments.length === 0 ? (
                  <EmptyState
                    icon={CalendarClockIcon}
                    title="No schedule assigned"
                    description={
                      profile.status === "pending"
                        ? "A schedule is chosen when the registration is approved."
                        : "Assign a schedule so attendance is classified as on time, late or undertime."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <caption className="sr-only">Schedule history</caption>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((a) => {
                          const state = assignmentState(a, today);
                          return (
                            <TableRow key={a.effective_from}>
                              <TableCell className="font-medium">{a.schedules?.name ?? "—"}</TableCell>
                              <TableCell className="tabular-nums">
                                {a.schedules
                                  ? `${formatWorkDays(a.schedules.work_days)} ${formatClock(a.schedules.start_time)}–${formatClock(a.schedules.end_time)}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="tabular-nums">{formatDate(a.effective_from)}</TableCell>
                              <TableCell className="tabular-nums">
                                {a.effective_to ? formatDate(a.effective_to) : "Open-ended"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={state === "current" ? "default" : state === "upcoming" ? "secondary" : "outline"}
                                  className="rounded-full"
                                >
                                  {ASSIGNMENT_LABELS[state]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {isEmployee ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent attendance</CardTitle>
            <CardDescription>
              {formatDate(from)} – {formatDate(today)} (Manila time)
            </CardDescription>
            <CardAction>
              <Button asChild variant="outline" className="h-11">
                <Link href={`/admin/dtr?employee=${profile.id}`}>
                  <FileTextIcon data-icon="inline-start" aria-hidden />
                  View DTR
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {historyRes.error ? (
              <ErrorState message="Attendance could not be loaded. Refresh the page to try again." />
            ) : (
              <EmployeeAttendanceTable rows={attendance} />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
