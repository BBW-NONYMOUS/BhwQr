import type { CorrectionType } from "@bhw/types";
import { Sheet } from "@tamagui/sheet";
import { Clock, FilePenLine } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type { HistoryRow } from "@/lib/queries/history";
import { STRINGS, type Lang } from "@/lib/messages";

import { formatManilaTime, formatMinutes, formatWorkDate } from "./dates";
import { AttendanceStatusBadge } from "./status-badge";
import { L, METHOD_LABELS_I18N } from "./strings";

/** Most likely correction type for a day, used to prefill the form. */
export function suggestedCorrectionType(row: Pick<HistoryRow, "status" | "time_in" | "time_out">): CorrectionType {
  if (row.status === "absent" || !row.time_in) return "missing_time_in";
  if (row.status === "incomplete" || !row.time_out) return "missing_time_out";
  return "wrong_time";
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-touch flex-row items-center justify-between gap-4 py-2">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium">{value}</Text>
    </View>
  );
}

/**
 * Attendance detail bottom sheet (Tamagui Sheet – one of Tamagui's two jobs in this app).
 * Contents use RN Reusables, which is allowed inside a Tamagui sheet (README provider order).
 */
export function AttendanceDetailSheet({
  row,
  open,
  onOpenChange,
  lang,
  canCorrect,
  onRequestCorrection,
}: {
  row: HistoryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
  /** False when the day is outside the D-26 correction window. */
  canCorrect: boolean;
  onRequestCorrection: (row: HistoryRow) => void;
}) {
  const s = L[lang];
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={[70, 40]}
      dismissOnSnapToBottom
      dismissOnOverlayPress
      transition="medium"
      zIndex={100_000}
    >
      <Sheet.Overlay bg="zinc950" opacity={0.5} />
      <Sheet.Handle self="center" width="10" height="1" rounded="full" bg="borderColor" my="2" />
      <Sheet.Container px="4" pt="4" pb="6">
        <Sheet.Background bg="background" borderTopLeftRadius="4" borderTopRightRadius="4" />
        {row ? (
          <Sheet.ScrollView>
            <View className="gap-1 pb-6" accessibilityLabel={s.attendanceDetails}>
              <Text className="text-xs uppercase text-muted-foreground">{s.attendanceDetails}</Text>
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-xl font-semibold">{formatWorkDate(row.work_date, lang)}</Text>
                <AttendanceStatusBadge status={row.status} lang={lang} />
              </View>

              <Separator className="my-2" />
              <DetailLine label={STRINGS[lang].timeIn} value={formatManilaTime(row.time_in)} />
              <DetailLine label={STRINGS[lang].timeOut} value={formatManilaTime(row.time_out)} />
              <DetailLine label={s.minutesLate} value={row.minutes_late > 0 ? formatMinutes(row.minutes_late) : s.none} />
              <DetailLine label={s.undertime} value={row.undertime_minutes > 0 ? formatMinutes(row.undertime_minutes) : s.none} />
              <DetailLine label={s.method} value={METHOD_LABELS_I18N[row.method][lang]} />
              <DetailLine label={s.station} value={row.station_name ?? "—"} />
              <DetailLine label={s.notes} value={row.notes ?? "—"} />
              <Separator className="my-2" />

              {row.pending_correction ? (
                <View className="flex-row items-start gap-2 rounded-2xl bg-status-late px-3 py-3">
                  <Icon as={Clock} size={16} className="mt-0.5 text-status-late-foreground" />
                  <Text className="flex-1 text-sm text-status-late-foreground">{s.pendingCorrectionLong}</Text>
                </View>
              ) : !canCorrect ? (
                <Text className="text-sm text-muted-foreground">{s.correctionNotAllowed}</Text>
              ) : null}

              <Button
                className="mt-3 min-h-touch"
                disabled={row.pending_correction || !canCorrect}
                onPress={() => onRequestCorrection(row)}
                accessibilityLabel={STRINGS[lang].requestCorrection}
              >
                <Icon as={FilePenLine} size={16} className="text-primary-foreground" />
                <Text>{STRINGS[lang].requestCorrection}</Text>
              </Button>
              <Button variant="ghost" className="min-h-touch" onPress={() => onOpenChange(false)}>
                <Text>{s.close}</Text>
              </Button>
            </View>
          </Sheet.ScrollView>
        ) : null}
      </Sheet.Container>
    </Sheet>
  );
}
