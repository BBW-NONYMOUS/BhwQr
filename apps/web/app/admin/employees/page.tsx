import type { Metadata } from "next";
import Link from "next/link";

import { AddStaffDialog } from "@/components/employees/add-staff-dialog";
import { isProfileStatus } from "@/components/employees/employee-helpers";
import { EmployeesTable, StaffTable, type EmployeeRow, type StaffRow } from "@/components/employees/employees-table";
import { hasServiceRoleKey, signProfilePhotos } from "@/components/employees/server-helpers";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: PageProps<"/admin/employees">) {
  await requireProfile(["admin"]);
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const initialStatus = isProfileStatus(statusParam) ? statusParam : "all";
  const tab = params.tab === "staff" ? "staff" : "employees";

  const supabase = await createClient();
  const today = manilaToday();

  const [profilesRes, devicesRes, schedulesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, bhw_id_number, area, email, photo_url, role, status, created_at")
      .order("full_name"),
    supabase.from("devices").select("employee_id, platform, model").is("revoked_at", null),
    supabase
      .from("employee_schedules")
      .select("employee_id, effective_from, schedules(name)")
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`),
  ]);

  const header = (
    <PageHeader
      title="Employees"
      description="BHW employee profiles, phones and schedules, plus staff accounts for admins, kiosks and viewers."
      actions={<AddStaffDialog enabled={hasServiceRoleKey()} />}
    />
  );

  const failed = profilesRes.error ?? devicesRes.error ?? schedulesRes.error;
  if (failed || !profilesRes.data) {
    return (
      <>
        {header}
        <ErrorState
          message="The employee list could not be loaded. Check your connection and try again."
          action={
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/admin/employees">Try again</Link>
            </Button>
          }
        />
      </>
    );
  }

  const devices = new Map((devicesRes.data ?? []).map((d) => [d.employee_id, d]));
  const scheduleNames = new Map<string, string>();
  for (const a of schedulesRes.data ?? []) {
    if (a.schedules?.name) scheduleNames.set(a.employee_id, a.schedules.name);
  }

  const employeesRaw = profilesRes.data.filter((p) => p.role === "employee");
  const photos = await signProfilePhotos(
    supabase,
    employeesRaw.map((p) => p.photo_url),
  );

  const employees: EmployeeRow[] = employeesRaw.map((p) => {
    const device = devices.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      bhw_id_number: p.bhw_id_number,
      area: p.area,
      email: p.email,
      status: p.status,
      photoUrl: p.photo_url ? (photos.get(p.photo_url) ?? null) : null,
      device: device ? { platform: device.platform, model: device.model } : null,
      scheduleName: scheduleNames.get(p.id) ?? null,
    };
  });

  const staff: StaffRow[] = profilesRes.data
    .filter((p) => p.role !== "employee")
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role,
      status: p.status,
      created_at: p.created_at,
    }));

  return (
    <>
      {header}
      <Tabs defaultValue={tab} className="gap-4">
        <TabsList>
          <TabsTrigger value="employees" className="px-3">
            BHW employees <span className="tabular-nums text-muted-foreground">({employees.length})</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="px-3">
            Staff accounts <span className="tabular-nums text-muted-foreground">({staff.length})</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="employees">
          <EmployeesTable rows={employees} initialStatus={initialStatus} today={today} />
        </TabsContent>
        <TabsContent value="staff">
          <StaffTable rows={staff} />
        </TabsContent>
      </Tabs>
    </>
  );
}
