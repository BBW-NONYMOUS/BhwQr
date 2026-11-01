import { router } from "expo-router";
import { CalendarX2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { SegmentedButtons } from "react-native-paper";

import { checkCorrectionDate } from "@/components/correction/eligibility";
import { AttendanceDetailSheet, suggestedCorrectionType } from "@/components/history/attendance-detail-sheet";
import { manilaToday } from "@/components/history/dates";
import { HistoryRow } from "@/components/history/history-row";
import { EmptyState, ErrorState, ListSkeleton, SavedCopyNote } from "@/components/history/list-states";
import { HISTORY_SEGMENTS, HISTORY_SEGMENT_LABELS, type HistorySegment } from "@/components/history/range";
import { L, friendlyError } from "@/components/history/strings";
import { colors } from "@bhw/design-tokens";
import { useAppTheme } from "@/lib/app-theme";
import { usePreferences } from "@/lib/preferences";
import { errorCodeOf, useHistory, type HistoryRow as HistoryRowData } from "@/lib/queries/history";
import { useCorrectionWindowDays } from "@/lib/queries/requests";
import { useOnline } from "@/lib/use-online";

/** History tab: Paper SegmentedButtons filter, cached list, Tamagui detail sheet (core flow 6 entry). */
export default function HistoryScreen() {
  const { lang } = usePreferences();
  const { scheme } = useAppTheme();
  useOnline(); // keeps TanStack's onlineManager current so the list refetches on reconnect
  const [segment, setSegment] = useState<HistorySegment>("this_week");
  const [selected, setSelected] = useState<HistoryRowData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const windowDays = useCorrectionWindowDays();
  const query = useHistory(segment);
  const s = L[lang];

  const buttons = useMemo(
    () =>
      HISTORY_SEGMENTS.map((value) => ({
        value,
        label: HISTORY_SEGMENT_LABELS[value][lang],
        accessibilityLabel: HISTORY_SEGMENT_LABELS[value][lang],
        style: { minHeight: 44, justifyContent: "center" as const },
      })),
    [lang],
  );

  const openRow = useCallback((row: HistoryRowData) => {
    setSelected(row);
    setSheetOpen(true);
  }, []);

  const requestCorrection = (row: HistoryRowData) => {
    setSheetOpen(false);
    router.push({ pathname: "/correction/new", params: { date: row.work_date, type: suggestedCorrectionType(row) } });
  };

  const canCorrect = selected ? checkCorrectionDate(selected.work_date, manilaToday(), windowDays).ok : false;
  const snapshot = query.data;
  const rows = snapshot?.data ?? [];

  return (
    <View className="flex-1 bg-background-subtle">
      <View className="px-4 pb-3 pt-3">
        <SegmentedButtons<HistorySegment>
          value={segment}
          onValueChange={setSegment}
          buttons={buttons}
        />
      </View>

      {snapshot?.fromCache ? <SavedCopyNote savedAt={snapshot.savedAt} lang={lang} /> : null}

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError && rows.length === 0 ? (
        <ErrorState message={friendlyError(errorCodeOf(query.error), lang)} lang={lang} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <HistoryRow row={item} lang={lang} onPress={openRow} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerClassName="pb-8 pt-1"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              colors={[colors[scheme].brand]}
              tintColor={colors[scheme].brand}
            />
          }
          ListEmptyComponent={<EmptyState icon={CalendarX2} title={s.noRecords} hint={s.noRecordsHint} />}
        />
      )}

      <AttendanceDetailSheet
        row={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lang={lang}
        canCorrect={canCorrect}
        onRequestCorrection={requestCorrection}
      />
    </View>
  );
}
