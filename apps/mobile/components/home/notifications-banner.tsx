import type { Lang } from "@bhw/types";
import { router } from "expo-router";
import { Bell, ChevronRight } from "lucide-react-native";
import { Pressable } from "react-native";

import { fill, HOME_COPY } from "@/components/home/copy";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/**
 * Unread notifications banner. Notifications are about registration, corrections and device
 * resets, so tapping opens My Requests where the decisions and remarks are listed.
 */
export function NotificationsBanner({ count, lang }: { count: number; lang: Lang }) {
  if (count <= 0) return null;
  const c = HOME_COPY[lang];
  const text = count === 1 ? c.unreadOne : fill(c.unread, { count });

  return (
    <Pressable
      onPress={() => router.push("/requests")}
      className="min-h-touch flex-row items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={text}
      testID="notifications-banner"
    >
      <Icon as={Bell} size={20} className="text-brand" />
      <Text className="flex-1 text-sm font-medium">{text}</Text>
      <Icon as={ChevronRight} size={18} className="text-brand" />
    </Pressable>
  );
}
