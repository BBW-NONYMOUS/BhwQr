import type { Lang } from "@bhw/types";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Fragment } from "react";
import { View } from "react-native";

import { HOME_COPY } from "@/components/home/copy";
import { StatusBadge } from "@/components/home/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";
import { formatManilaShortDate, formatManilaTime, type HomeRecord } from "@/lib/queries/home";

/** Last 5 attendance records with status and times; "See all" opens the History tab. */
export function RecentCard({ records, lang }: { records: HomeRecord[]; lang: Lang }) {
  const c = HOME_COPY[lang];
  const s = STRINGS[lang];

  return (
    <Card className="gap-3" testID="recent-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{s.recent}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-touch"
          onPress={() => router.navigate("/(tabs)/history")}
          accessibilityLabel={`${c.seeAll} – ${s.history}`}
        >
          <Text className="text-brand">{c.seeAll}</Text>
          <Icon as={ChevronRight} size={16} className="text-brand" />
        </Button>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <Text className="py-2 text-muted-foreground">{c.noRecords}</Text>
        ) : (
          records.map((r, i) => {
            const date = formatManilaShortDate(r.work_date, lang);
            const times = `${formatManilaTime(r.time_in, lang)} – ${formatManilaTime(r.time_out, lang)}`;
            return (
              <Fragment key={r.id}>
                {i > 0 ? <Separator /> : null}
                <View
                  className="min-h-touch flex-row items-center justify-between gap-3 py-2"
                  accessible
                  accessibilityLabel={`${date}. ${s.timeIn} ${formatManilaTime(r.time_in, lang)}, ${s.timeOut} ${formatManilaTime(r.time_out, lang)}`}
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="font-medium">{date}</Text>
                    <Text className="text-sm text-muted-foreground">{times}</Text>
                  </View>
                  <StatusBadge status={r.status} lang={lang} />
                </View>
              </Fragment>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
