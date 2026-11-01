import type { LucideIcon } from "lucide-react-native";
import { CloudOff } from "lucide-react-native";
import { View } from "react-native";

import { Skeleton } from "@/components/gluestack/skeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { STRINGS, type Lang } from "@/lib/messages";

import { formatManilaDateTime } from "./dates";
import { L } from "./strings";

/** gluestack Skeleton placeholders shaped like list cards. */
export function ListSkeleton({ rows = 5, height = 72 }: { rows?: number; height?: number }) {
  return (
    <View className="gap-3 px-4 pt-2" accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-2xl" style={{ height }} />
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <View className="items-center gap-3 px-8 py-16">
      <View className="size-16 items-center justify-center rounded-full bg-muted">
        <Icon as={icon} size={28} className="text-muted-foreground" />
      </View>
      <Text className="text-center text-base font-semibold">{title}</Text>
      {hint ? <Text className="text-center text-sm text-muted-foreground">{hint}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, lang, onRetry }: { message: string; lang: Lang; onRetry: () => void }) {
  return (
    <View className="items-center gap-3 px-8 py-16" accessibilityLiveRegion="polite">
      <Text className="text-center text-base font-semibold">{L[lang].loadFailed}</Text>
      <Text className="text-center text-sm text-muted-foreground">{message}</Text>
      <Button variant="outline" className="min-h-touch px-6" onPress={onRetry}>
        <Text>{STRINGS[lang].retry}</Text>
      </Button>
    </View>
  );
}

/** "Offline – showing the copy saved on …" banner for cached snapshots. */
export function SavedCopyNote({ savedAt, lang }: { savedAt: number; lang: Lang }) {
  return (
    <View className="mx-4 mb-2 flex-row items-start gap-2 rounded-2xl border border-border bg-muted px-3 py-2" accessibilityLiveRegion="polite">
      <Icon as={CloudOff} size={16} className="mt-0.5 text-muted-foreground" />
      <View className="flex-1">
        <Text className="text-sm">
          {L[lang].savedCopy} {formatManilaDateTime(savedAt, lang)}.
        </Text>
        <Text className="text-xs text-muted-foreground">{L[lang].pullToRefresh}</Text>
      </View>
    </View>
  );
}
