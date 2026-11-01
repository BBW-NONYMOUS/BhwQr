import { View } from "react-native";

import { formatMinutes } from "@/components/history/dates";
import { L } from "@/components/history/strings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";

import { dtrTotalItems, type DtrTotals as DtrTotalsData } from "./format";

/** Monthly totals from `get_dtr().totals` – printed exactly as the server computed them (AC-09). */
export function DtrTotals({ totals, lang }: { totals: DtrTotalsData; lang: Lang }) {
  const s = L[lang];
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{s.totals}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <View className="flex-row flex-wrap gap-2">
          {dtrTotalItems(totals, lang).map((item) => (
            <View key={item.key} className="min-w-[30%] flex-1 items-center rounded-md bg-muted px-2 py-2" accessible accessibilityLabel={`${item.label}: ${item.value}`}>
              <Text className="text-lg font-semibold">{item.value}</Text>
              <Text className="text-center text-xs text-muted-foreground">{item.label}</Text>
            </View>
          ))}
        </View>
        <Separator />
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-sm text-muted-foreground">{s.totalUndertime}</Text>
          <Text className="text-sm font-semibold">
            {formatMinutes(totals.undertime_total_minutes)} ({totals.undertime_hours} h {totals.undertime_minutes} m)
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
