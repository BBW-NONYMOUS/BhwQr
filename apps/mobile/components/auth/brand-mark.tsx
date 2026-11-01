import type { Lang } from "@bhw/types";
import { QrCode } from "lucide-react-native";
import { View } from "react-native";

import { AUTH_COPY } from "@/components/auth/copy";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/** Teal brand mark + app name used on the auth screens. */
export function BrandMark({ lang }: { lang: Lang }) {
  const c = AUTH_COPY[lang];
  return (
    <View className="items-center gap-3" accessible accessibilityRole="header" accessibilityLabel={`${c.appName}. ${c.office}`}>
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand">
        <Icon as={QrCode} size={32} className="text-brand-foreground" />
      </View>
      <Text className="text-2xl font-bold">{c.appName}</Text>
      <Text className="text-center text-sm text-muted-foreground">{c.office}</Text>
    </View>
  );
}
