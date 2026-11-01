import type { Lang } from "@bhw/types";
import { Clock } from "lucide-react-native";
import { View } from "react-native";

import { fill, HOME_COPY } from "@/components/home/copy";
import { StatusBadge } from "@/components/home/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";
import {
  formatManilaTime,
  formatScheduleTime,
  isoWeekday,
  type HomeRecord,
  type HomeSchedule,
} from "@/lib/queries/home";

function TimeTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1 rounded-md bg-muted px-3 py-2" accessible accessibilityLabel={`${label}: ${value}`}>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-xl font-semibold">{value}</Text>
    </View>
  );
}

/** Today card: status badge, time-in / time-out and today's schedule. */
export function TodayCard({
  record,
  schedule,
  today,
  lang,
}: {
  record: HomeRecord | null;
  schedule: HomeSchedule | null;
  today: string;
  lang: Lang;
}) {
  const c = HOME_COPY[lang];
  const s = STRINGS[lang];
  const isWorkDay = schedule ? schedule.work_days.includes(isoWeekday(today)) : false;

  return (
    <Card className="gap-4" testID="today-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{s.today}</CardTitle>
        {record ? <StatusBadge status={record.status} lang={lang} /> : null}
      </CardHeader>
      <CardContent className="gap-4">
        {record ? (
          <>
            <View className="flex-row gap-3">
              <TimeTile label={s.timeIn} value={formatManilaTime(record.time_in, lang)} />
              <TimeTile label={s.timeOut} value={formatManilaTime(record.time_out, lang)} />
            </View>
            {record.minutes_late > 0 || record.undertime_minutes > 0 ? (
              <Text className="text-sm text-muted-foreground">
                {[
                  record.minutes_late > 0 ? fill(c.late, { minutes: record.minutes_late }) : null,
                  record.undertime_minutes > 0 ? fill(c.undertime, { minutes: record.undertime_minutes }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="text-muted-foreground">{s.noRecordToday}</Text>
        )}

        <Separator />

        <View className="flex-row items-start gap-3">
          <Icon as={Clock} size={18} className="mt-0.5 text-muted-foreground" />
          <View className="flex-1 gap-0.5">
            <Text className="text-xs text-muted-foreground">{c.schedule}</Text>
            {schedule ? (
              <>
                <Text className="font-medium">
                  {schedule.name} · {formatScheduleTime(schedule.start_time, today, lang)} –{" "}
                  {formatScheduleTime(schedule.end_time, today, lang)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {isWorkDay ? fill(c.graceMinutes, { minutes: schedule.grace_minutes }) : c.restDay}
                </Text>
              </>
            ) : (
              <Text className="text-sm">{c.noSchedule}</Text>
            )}
          </View>
        </View>
      </CardContent>
    </Card>
  );
}
