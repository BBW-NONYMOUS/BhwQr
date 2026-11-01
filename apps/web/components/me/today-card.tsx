import { CalendarCheckIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";

import type { HistoryRow } from "./history-table";

/** Today's record: status, time in and time out (Manila time, computed by the server). */
export function TodayCard({ today, record }: { today: string; record: HistoryRow | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheckIcon className="size-5 text-brand" aria-hidden />
          Today <span className="font-normal text-muted-foreground">· Ngayong araw</span>
        </CardTitle>
        <CardDescription>{formatDate(today)}</CardDescription>
      </CardHeader>
      <CardContent>
        {record ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={record.status} />
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Time in · Pasok</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatTime(record.time_in)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Time out · Labas</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatTime(record.time_out)}</dd>
            </div>
            {record.minutes_late > 0 ? (
              <div className="space-y-1">
                <dt className="text-sm text-muted-foreground">Late · Huli</dt>
                <dd className="tabular-nums">{formatMinutes(record.minutes_late)}</dd>
              </div>
            ) : null}
            {record.undertime_minutes > 0 ? (
              <div className="space-y-1">
                <dt className="text-sm text-muted-foreground">Undertime</dt>
                <dd className="tabular-nums">{formatMinutes(record.undertime_minutes)}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-muted-foreground">
            No time-in yet today. Scan the kiosk QR with the mobile app when you arrive.
            <span className="mt-1 block text-sm">Wala ka pang time-in ngayon.</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
