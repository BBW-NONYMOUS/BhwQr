import { ChevronRight, Clock } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { HistoryRow as HistoryRowData } from "@/lib/queries/history";
import { statusLabel, type Lang } from "@/lib/messages";

import { formatManilaTime, formatWorkDate } from "./dates";
import { AttendanceStatusBadge } from "./status-badge";
import { L, METHOD_LABELS_I18N } from "./strings";

/** One day in the History list: date, status badge, Manila time in/out and method. */
export function HistoryRow({ row, lang, onPress }: { row: HistoryRowData; lang: Lang; onPress: (row: HistoryRowData) => void }) {
  const s = L[lang];
  const timeIn = formatManilaTime(row.time_in);
  const timeOut = formatManilaTime(row.time_out);
  const date = formatWorkDate(row.work_date, lang, false);
  return (
    <Pressable
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityLabel={`${date}, ${statusLabel(row.status, lang)}, ${s.in} ${timeIn}, ${s.out} ${timeOut}`}
      accessibilityHint={s.attendanceDetails}
      className="mx-4 min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-accent"
    >
      <View className="flex-1 gap-1.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-base font-semibold">{date}</Text>
          <AttendanceStatusBadge status={row.status} lang={lang} />
        </View>
        <Text className="text-sm text-muted-foreground">
          {s.in} <Text className="text-sm font-medium text-foreground">{timeIn}</Text>
          {"   "}
          {s.out} <Text className="text-sm font-medium text-foreground">{timeOut}</Text>
          {"   ·   "}
          {METHOD_LABELS_I18N[row.method][lang]}
        </Text>
        {row.pending_correction ? (
          <View className="flex-row items-center gap-1">
            <Icon as={Clock} size={12} className="text-status-late-foreground" />
            <Text className="text-xs text-muted-foreground">{s.pendingCorrection}</Text>
          </View>
        ) : null}
      </View>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}
