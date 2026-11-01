import type { Lang } from "@bhw/types";
import { View } from "react-native";

import { HOME_COPY } from "@/components/home/copy";
import { Text } from "@/components/ui/text";
import { formatManilaLongDate, manilaHour } from "@/lib/queries/home";

export function greetingFor(hour: number, lang: Lang): string {
  const c = HOME_COPY[lang];
  if (hour < 12) return c.goodMorning;
  if (hour < 18) return c.goodAfternoon;
  return c.goodEvening;
}

/** "Good morning, Maria" + the Manila date. */
export function HomeHeader({ fullName, today, lang }: { fullName: string | null | undefined; today: string; lang: Lang }) {
  const firstName = fullName?.trim().split(/\s+/)[0];
  const greeting = greetingFor(manilaHour(), lang);

  return (
    <View className="gap-1" accessibilityRole="header">
      <Text className="text-2xl font-bold">{firstName ? `${greeting}, ${firstName}` : greeting}</Text>
      <Text className="text-sm text-muted-foreground">{formatManilaLongDate(today, lang)}</Text>
    </View>
  );
}
