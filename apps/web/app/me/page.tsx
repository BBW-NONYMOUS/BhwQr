import { SmartphoneIcon } from "lucide-react";

import { DtrDownload } from "@/components/me/dtr-download";
import { HistoryTable } from "@/components/me/history-table";
import { monthToDate, recentMonths } from "@/components/me/me-utils";
import { NotificationsList } from "@/components/me/notifications-list";
import { RequestsList } from "@/components/me/requests-list";
import { TodayCard } from "@/components/me/today-card";
import { signProfilePhotos } from "@/components/employees/server-helpers";
import { PageHeader } from "@/components/page-header";
import { ProfilePhotoCard } from "@/components/profile/profile-photo-card";
import { ErrorState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fromDbError } from "@/lib/actions";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function dbErrorMessage(error: { message?: string; code?: string } | null): string {
  const result = fromDbError(error);
  return result.ok ? "" : result.message;
}

/** Employee web page (screen "/me"): today, this month, DTR download, notifications, requests. */
export default async function MePage() {
  const profile = await requireProfile(["employee"]);
  const supabase = await createClient();
  const today = manilaToday();
  const { from, to } = monthToDate(today);

  const [history, notifications, requests, photos] = await Promise.all([
    supabase.rpc("get_employee_history", { p_employee_id: profile.id, p_from: from, p_to: to }),
    supabase
      .from("notifications")
      .select("id, title, body, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("correction_requests")
      .select("id, type, work_date, status, remarks, created_at")
      .eq("employee_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
    signProfilePhotos(supabase, [profile.photo_url]),
  ]);

  const historyRows = history.data ?? [];
  const todayRecord = historyRows.find((r) => r.work_date === today);
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hello, ${firstName}`}
        description={`My Attendance · Aking Attendance${profile.bhw_id_number ? ` · BHW ID ${profile.bhw_id_number}` : ""}`}
      />

      <Alert>
        <SmartphoneIcon />
        <AlertTitle>Scanning and corrections are in the mobile app</AlertTitle>
        <AlertDescription>
          <p>
            Time in and time out by scanning the kiosk QR with the BHW Attendance app. File
            correction requests there too; this page shows your records.
          </p>
          <p lang="fil">
            Ang pag-scan at pag-file ng correction ay ginagawa sa BHW Attendance app sa iyong
            cellphone.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {history.error ? (
          <ErrorState message={dbErrorMessage(history.error)} />
        ) : (
          <TodayCard today={today} record={todayRecord} />
        )}
        <DtrDownload
          employeeId={profile.id}
          bhwIdNumber={profile.bhw_id_number ?? "employee"}
          months={recentMonths(today, 6)}
        />
      </div>

      <ProfilePhotoCard
        name={profile.full_name}
        photoUrl={profile.photo_url ? (photos.get(profile.photo_url) ?? null) : null}
        hasPhoto={Boolean(profile.photo_url)}
      />

      <section aria-labelledby="month-title" className="flex flex-col gap-3">
        <h2 id="month-title" className="text-lg font-semibold">
          This month <span className="text-muted-foreground font-normal">· Ngayong buwan</span>
        </h2>
        {history.error ? (
          <ErrorState message={dbErrorMessage(history.error)} />
        ) : (
          <HistoryTable rows={historyRows} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {notifications.error ? (
          <ErrorState message={dbErrorMessage(notifications.error)} />
        ) : (
          <NotificationsList userId={profile.id} initial={notifications.data} />
        )}
        {requests.error ? (
          <ErrorState message={dbErrorMessage(requests.error)} />
        ) : (
          <RequestsList items={requests.data} />
        )}
      </div>
    </div>
  );
}
