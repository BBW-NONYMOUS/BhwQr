import type { Lang } from "@bhw/types";
import { View } from "react-native";

import { fill, HOME_COPY } from "@/components/home/copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";

export interface WeekSummary {
  present: number;
  scheduled: number;
  percent: number;
}

/** This Week: days with a time-in / scheduled work days (RN Reusables Progress). */
export function WeekCard({ summary, lang }: { summary: WeekSummary; lang: Lang }) {
  const c = HOME_COPY[lang];
  const text =
    summary.scheduled > 0
      ? fill(c.weekSummary, { present: summary.present, scheduled: summary.scheduled })
      : c.weekNoSchedule;

  return (
    <Card className="gap-4" testID="week-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{STRINGS[lang].thisWeek}</CardTitle>
        <Text className="text-lg font-semibold text-brand">
          {summary.present}/{summary.scheduled}
        </Text>
      </CardHeader>
      <CardContent className="gap-2">
        <View accessible accessibilityRole="progressbar" accessibilityLabel={text} accessibilityValue={{ min: 0, max: 100, now: summary.percent }}>
          <Progress value={summary.percent} className="h-3 bg-brand/20" indicatorClassName="bg-brand" />
        </View>
        <Text className="text-sm text-muted-foreground">{text}</Text>
      </CardContent>
    </Card>
  );
}
