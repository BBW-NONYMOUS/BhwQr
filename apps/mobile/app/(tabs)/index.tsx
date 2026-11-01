import { colors } from "@bhw/design-tokens";
import { router } from "expo-router";
import { FileText, RefreshCw } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { HOME_COPY } from "@/components/home/copy";
import { HomeHeader } from "@/components/home/home-header";
import { HomeSkeleton } from "@/components/home/home-skeleton";
import { NotificationsBanner } from "@/components/home/notifications-banner";
import { RecentCard } from "@/components/home/recent-card";
import { TodayCard } from "@/components/home/today-card";
import { WeekCard } from "@/components/home/week-card";
import { useStartScan } from "@/components/scan/use-start-scan";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/lib/app-theme";
import { errorMessage } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";
import {
  manilaToday,
  useCurrentSchedule,
  useRecentRecords,
  useTodayRecord,
  useUnreadNotifications,
  useWeekProgress,
} from "@/lib/queries/home";
import { useSession } from "@/lib/session";
import { useOnline } from "@/lib/use-online";

/**
 * Home tab: greeting + Manila date, unread notifications, Today, This Week, Recent 5 and the
 * Paper FAB "Scan" (disabled offline — scans are never queued, see app/scan.tsx).
 */
export default function HomeScreen() {
  const { profile } = useSession();
  const { lang, t } = usePreferences();
  const { scheme } = useAppTheme();
  const online = useOnline();
  const startScan = useStartScan();
  const c = HOME_COPY[lang];
  const palette = colors[scheme];

  const userId = profile?.id;
  // Recomputed on every render, so the screen rolls over to the new day after midnight Manila time.
  const today = manilaToday();

  const todayQ = useTodayRecord(userId, today);
  const scheduleQ = useCurrentSchedule(userId, today);
  const weekQ = useWeekProgress(userId, today, scheduleQ.data?.work_days ?? null);
  const recentQ = useRecentRecords(userId);
  const unreadQ = useUnreadNotifications(userId);

  const core = [todayQ, scheduleQ, weekQ, recentQ];
  const isLoading = core.some((q) => q.isPending);
  const isError = core.some((q) => q.isError);

  const [refreshing, setRefreshing] = useState(false);
  const refetchAll = useCallback(async () => {
    await Promise.all([todayQ.refetch(), scheduleQ.refetch(), weekQ.refetch(), recentQ.refetch(), unreadQ.refetch()]);
  }, [todayQ, scheduleQ, weekQ, recentQ, unreadQ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

  const content = useMemo(() => {
    if (isLoading && !isError) return <HomeSkeleton />;
    if (isError && !todayQ.data && !recentQ.data) {
      return (
        <Card testID="home-error">
          <CardContent className="items-center gap-3">
            <Text className="text-center font-semibold">{c.loadFailed}</Text>
            <Text className="text-center text-sm text-muted-foreground">
              {errorMessage(online ? "INTERNAL_ERROR" : "OFFLINE", lang)}
            </Text>
            <Button variant="outline" className="min-h-touch" onPress={() => void refetchAll()}>
              <Icon as={RefreshCw} size={16} />
              <Text>{t("retry")}</Text>
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <View className="gap-4">
        <TodayCard record={todayQ.data ?? null} schedule={scheduleQ.data ?? null} today={today} lang={lang} />
        {weekQ.summary ? <WeekCard summary={weekQ.summary} lang={lang} /> : null}
        <RecentCard records={recentQ.data ?? []} lang={lang} />
        <Button variant="outline" className="min-h-touch" onPress={() => router.push("/dtr")}>
          <Icon as={FileText} size={16} />
          <Text>{c.myDtr}</Text>
        </Button>
      </View>
    );
  }, [isLoading, isError, todayQ.data, recentQ.data, scheduleQ.data, weekQ.summary, today, lang, online, c, t, refetchAll]);

  return (
    <SafeAreaView className="flex-1 bg-background-subtle" edges={["top"]}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-28 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={palette.brand}
            colors={[palette.brand]}
            progressBackgroundColor={palette.card}
          />
        }
      >
        <HomeHeader fullName={profile?.full_name} today={today} lang={lang} />
        <NotificationsBanner count={unreadQ.data ?? 0} lang={lang} />
        {content}
      </ScrollView>

      <FAB
        icon="qrcode-scan"
        label={t("scan")}
        onPress={() => void startScan()}
        disabled={!online}
        accessibilityLabel={online ? c.scanLabel : c.scanDisabledOffline}
        accessibilityState={{ disabled: !online }}
        color={online ? palette.brandForeground : undefined}
        style={{ position: "absolute", right: 16, bottom: 16, ...(online ? { backgroundColor: palette.brand } : null) }}
        testID="scan-fab"
      />
    </SafeAreaView>
  );
}
