import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheckIcon, MailCheckIcon, ShieldCheckIcon, UserCheckIcon } from "lucide-react";

import { ApprovalActions } from "@/components/employees/approval-actions";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { formatClock, formatWorkDays } from "@/components/employees/employee-helpers";
import type { ScheduleOption } from "@/components/employees/schedule-dialog";
import { signProfilePhotos } from "@/components/employees/server-helpers";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { formatDateTime, manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pending approvals" };

/** Pending Approvals (core flow 2, FR-21): e-mail-verified registrations, oldest first. */
export default async function ApprovalsPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const today = manilaToday();

  const [pendingRes, schedulesRes] = await Promise.all([
    supabase.rpc("list_pending_registrations"),
    supabase
      .from("schedules")
      .select("id, name, work_days, start_time, end_time, grace_minutes")
      .order("name"),
  ]);

  const header = (
    <PageHeader
      title="Pending approvals"
      description="Registrations with a verified e-mail, oldest first. Approving assigns a schedule and activates the account."
    />
  );

  if (pendingRes.error || schedulesRes.error) {
    return (
      <>
        {header}
        <ErrorState
          message="Pending registrations could not be loaded. Check your connection and try again."
          action={
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/admin/approvals">Try again</Link>
            </Button>
          }
        />
      </>
    );
  }

  const pending = pendingRes.data ?? [];
  const schedules: ScheduleOption[] = (schedulesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    summary: `${formatWorkDays(s.work_days)} · ${formatClock(s.start_time)}–${formatClock(s.end_time)} · ${s.grace_minutes} min grace`,
  }));
  // list_pending_registrations() has no consent date; FR-21 shows it, so read it from profiles.
  const [photos, consentRes] = await Promise.all([
    signProfilePhotos(
      supabase,
      pending.map((p) => p.photo_url),
    ),
    pending.length > 0
      ? supabase
          .from("profiles")
          .select("id, consent_at")
          .in(
            "id",
            pending.map((p) => p.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  const consent = new Map((consentRes.data ?? []).map((c) => [c.id, c.consent_at]));

  if (pending.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={UserCheckIcon}
          title="No registrations waiting"
          description="New BHW registrations appear here once the registrant verifies their e-mail address."
          action={
            <Button asChild variant="outline" className="h-11">
              <Link href="/admin/employees">Go to Employees</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
        <Badge variant="secondary" className="mr-2 tabular-nums">
          {pending.length}
        </Badge>
        {pending.length === 1 ? "registration is" : "registrations are"} waiting for review.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Pending registrations">
        {pending.map((p) => {
          const photoUrl = p.photo_url ? (photos.get(p.photo_url) ?? null) : null;
          return (
            <li key={p.id}>
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                  <EmployeeAvatar name={p.full_name} photoUrl={photoUrl} size="xl" />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="truncate text-base">
                      <Link
                        href={`/admin/employees/${p.id}`}
                        className="focus-visible:ring-ring/50 rounded-sm outline-none hover:underline focus-visible:ring-3"
                      >
                        {p.full_name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="truncate">{p.email}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs font-medium">BHW ID number</dt>
                      <dd className="font-medium tabular-nums">{p.bhw_id_number ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs font-medium">Purok / area</dt>
                      <dd>{p.area ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                        <CalendarCheckIcon className="size-3" aria-hidden />
                        Registered
                      </dt>
                      <dd className="tabular-nums">{formatDateTime(p.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                        <MailCheckIcon className="size-3" aria-hidden />
                        E-mail verified
                      </dt>
                      <dd className="tabular-nums">{formatDateTime(p.email_confirmed_at)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                        <ShieldCheckIcon className="size-3" aria-hidden />
                        Data Privacy consent
                      </dt>
                      <dd className="tabular-nums">{formatDateTime(consent.get(p.id))}</dd>
                    </div>
                  </dl>
                </CardContent>
                <CardFooter>
                  <ApprovalActions
                    employeeId={p.id}
                    employeeName={p.full_name}
                    schedules={schedules}
                    today={today}
                    hasPhoto={Boolean(p.photo_url)}
                  />
                </CardFooter>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
