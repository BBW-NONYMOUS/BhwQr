import { Stack } from "expo-router";
import { ChevronLeft, ChevronRight, Download } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { DtrTable } from "@/components/dtr/dtr-table";
import { DtrTotals } from "@/components/dtr/dtr-totals";
import { Spinner } from "@/components/gluestack/spinner";
import { compareYearMonth, formatMonthLabel, manilaToday, shiftMonth, yearMonthOf, type YearMonth } from "@/components/history/dates";
import { ErrorState, ListSkeleton, SavedCopyNote } from "@/components/history/list-states";
import { L, friendlyError } from "@/components/history/strings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors } from "@bhw/design-tokens";
import { useAppTheme } from "@/lib/app-theme";
import { reportError } from "@/lib/api";
import { usePreferences } from "@/lib/preferences";
import { downloadAndShareDtrPdf, useDtr } from "@/lib/queries/dtr";
import { errorCodeOf } from "@/lib/queries/history";
import { useSession } from "@/lib/session";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/** Oldest month offered (the system's first year, get_dtr accepts 2024+). */
const MIN_MONTH: YearMonth = { year: 2024, month: 1 };

function MonthButton({ label, icon, disabled, onPress }: { label: string; icon: typeof ChevronLeft; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn("size-11 items-center justify-center rounded-full border border-border bg-card active:bg-accent", disabled && "opacity-40")}
    >
      <Icon as={icon} size={20} />
    </Pressable>
  );
}

/** My DTR (core flow 7): month selector, CSC Form 48 table, totals, PDF download + share. */
export default function DtrScreen() {
  const { lang } = usePreferences();
  const { scheme } = useAppTheme();
  const { profile } = useSession();
  const online = useOnline();
  const s = L[lang];
  const current = yearMonthOf(manilaToday());
  const [period, setPeriod] = useState<YearMonth>(current);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const query = useDtr(period.year, period.month);
  const snapshot = query.data;
  const doc = snapshot?.data;

  const canGoNext = compareYearMonth(period, current) < 0;
  const canGoPrev = compareYearMonth(period, MIN_MONTH) > 0;

  const changeMonth = (delta: number) => {
    setDownloadError(null);
    setPeriod((p) => shiftMonth(p, delta));
  };

  const download = async () => {
    if (!profile) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadAndShareDtrPdf({
        employeeId: profile.id,
        bhwId: profile.bhw_id_number,
        year: period.year,
        month: period.month,
        dialogTitle: `${s.myDtr} – ${formatMonthLabel(period, lang)}`,
      });
    } catch (e) {
      const code = errorCodeOf(e);
      if (code === "INTERNAL_ERROR") void reportError("DTR PDF download failed", { error: String(e), ...period });
      setDownloadError(friendlyError(code, lang));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View className="flex-1 bg-background-subtle">
      <Stack.Screen options={{ headerShown: true, title: s.myDtr }} />

      <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-3">
        <MonthButton label={s.previousMonth} icon={ChevronLeft} disabled={!canGoPrev} onPress={() => changeMonth(-1)} />
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold" accessibilityLiveRegion="polite">
            {formatMonthLabel(period, lang)}
          </Text>
          <Text className="text-xs text-muted-foreground">{s.dtrSubtitle}</Text>
        </View>
        <MonthButton label={s.nextMonth} icon={ChevronRight} disabled={!canGoNext} onPress={() => changeMonth(1)} />
      </View>

      {snapshot?.fromCache ? <SavedCopyNote savedAt={snapshot.savedAt} lang={lang} /> : null}

      {query.isPending ? (
        <ListSkeleton rows={6} height={48} />
      ) : !doc ? (
        <ErrorState message={friendlyError(errorCodeOf(query.error), lang)} lang={lang} onRetry={() => void query.refetch()} />
      ) : (
        <ScrollView
          contentContainerClassName="gap-4 px-4 pb-12 pt-1"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              colors={[colors[scheme].brand]}
              tintColor={colors[scheme].brand}
            />
          }
        >
          <View className="gap-0.5">
            <Text className="text-base font-semibold">{doc.employee.full_name}</Text>
            <Text className="text-xs text-muted-foreground">
              {doc.employee.bhw_id_number ?? "—"} · {doc.office.name}
            </Text>
            {doc.office_hours.regular_days ? (
              <Text className="text-xs text-muted-foreground">
                {s.regularDays}: {doc.office_hours.regular_days}
              </Text>
            ) : null}
          </View>

          <DtrTable rows={doc.rows} lang={lang} />
          <DtrTotals totals={doc.totals} lang={lang} />

          {!online ? <Text className="text-center text-sm text-muted-foreground">{s.dtrOfflineDownload}</Text> : null}
          {downloadError ? (
            <Text className="text-center text-sm text-destructive" accessibilityLiveRegion="assertive">
              {downloadError}
            </Text>
          ) : null}
          <Button className="min-h-[48px]" onPress={() => void download()} disabled={downloading || !online}>
            {downloading ? (
              <Spinner size="small" className="text-primary-foreground" />
            ) : (
              <Icon as={Download} size={16} className="text-primary-foreground" />
            )}
            <Text>{downloading ? s.downloading : s.downloadPdf}</Text>
          </Button>
        </ScrollView>
      )}
    </View>
  );
}
