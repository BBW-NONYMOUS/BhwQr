import { colors } from "@bhw/design-tokens";
import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Switch, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/lib/app-theme";

/** Label / value line in the profile card. */
export function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-touch flex-row items-center justify-between gap-4 py-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** Tappable navigation row (≥ 44 px) with an icon and chevron. */
export function LinkRow({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      className="min-h-[52px] flex-row items-center gap-3 px-4 active:bg-accent"
    >
      <Icon as={icon} size={20} className="text-muted-foreground" />
      <Text className="flex-1 text-base">{label}</Text>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}

/** RN core Switch styled with the design tokens (README: Profile toggles). */
export function SwitchRow({
  label,
  hint,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { scheme } = useAppTheme();
  const c = colors[scheme];
  return (
    <View className="min-h-[56px] flex-row items-center gap-3">
      <View className="flex-1 gap-0.5">
        <Text className="text-base">{label}</Text>
        {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: c.input, true: c.brand }}
        thumbColor={c.background}
        ios_backgroundColor={c.input}
      />
    </View>
  );
}
