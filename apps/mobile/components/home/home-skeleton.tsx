import { View } from "react-native";

import { Skeleton, SkeletonText } from "@/components/gluestack/skeleton";

/** gluestack Skeleton placeholders shaped like the Home cards. */
export function HomeSkeleton() {
  return (
    <View className="gap-4" accessibilityLabel="Loading" accessibilityState={{ busy: true }} testID="home-skeleton">
      <View className="gap-3 rounded-2xl border border-border bg-card p-6">
        <Skeleton variant="rounded" className="h-5 w-24" />
        <View className="flex-row gap-3">
          <Skeleton variant="rounded" className="h-16 flex-1" />
          <Skeleton variant="rounded" className="h-16 flex-1" />
        </View>
        <SkeletonText _lines={2} className="h-3" />
      </View>
      <View className="gap-3 rounded-2xl border border-border bg-card p-6">
        <Skeleton variant="rounded" className="h-5 w-28" />
        <Skeleton variant="rounded" className="h-3 w-full" />
      </View>
      <View className="gap-3 rounded-2xl border border-border bg-card p-6">
        <Skeleton variant="rounded" className="h-5 w-20" />
        <SkeletonText _lines={3} className="h-4" />
      </View>
    </View>
  );
}
