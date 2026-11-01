import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import type { SettingsFormValues } from "@/components/setup/settings";
import { SettingsForm } from "@/components/setup/settings-form";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { updateSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage(_props: PageProps<"/admin/settings">) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="System-wide rules for scanning, kiosks, corrections and printed documents. Every change is recorded in the Audit Log."
      />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsData />
      </Suspense>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Staff accounts</CardTitle>
          <CardDescription>
            Admin, viewer and kiosk accounts, roles and deactivation are managed with employee records.
          </CardDescription>
          <CardAction>
            <Button asChild variant="outline">
              <Link href="/admin/employees">
                <UsersIcon data-icon="inline-start" aria-hidden />
                Go to Employees
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    </>
  );
}

async function SettingsData() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*, editor:profiles!app_settings_updated_by_fkey(full_name)")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return <ErrorState message="Settings could not be loaded. Please refresh the page." />;
  }

  const initial: SettingsFormValues = {
    geofence_radius_m: data.geofence_radius_m,
    max_gps_accuracy_m: data.max_gps_accuracy_m,
    cooldown_minutes: data.cooldown_minutes,
    token_lifetime_seconds: data.token_lifetime_seconds,
    token_refresh_seconds: data.token_refresh_seconds,
    selfie_required: data.selfie_required,
    selfie_retention_days: data.selfie_retention_days,
    overnight_cutoff_hour: data.overnight_cutoff_hour,
    correction_window_days: data.correction_window_days,
    heartbeat_interval_seconds: data.heartbeat_interval_seconds,
    dtr_fill_break_times: data.dtr_fill_break_times,
    office_name: data.office_name,
    office_address: data.office_address,
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Last changed {formatDateTime(data.updated_at)}
        {data.editor?.full_name ? ` by ${data.editor.full_name}` : ""} (Manila time).
      </p>
      <SettingsForm initial={initial} action={updateSettings} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading settings">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-xl" />
      ))}
    </div>
  );
}
