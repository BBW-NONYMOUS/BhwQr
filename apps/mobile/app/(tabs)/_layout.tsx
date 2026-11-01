import { colors } from "@bhw/design-tokens";
import { Tabs } from "expo-router/js-tabs";
import { House, ListChecks, QrCode, User, type LucideIcon } from "lucide-react-native";
import type { ColorValue } from "react-native";

import { useAppTheme } from "@/lib/app-theme";
import { usePreferences } from "@/lib/preferences";

function tabIcon(IconComponent: LucideIcon) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <IconComponent color={typeof color === "string" ? color : undefined} size={size} />;
  }
  return TabIcon;
}

const HomeIcon = tabIcon(House);
const HistoryIcon = tabIcon(ListChecks);
const QrIcon = tabIcon(QrCode);
const ProfileIcon = tabIcon(User);

/**
 * Bottom tabs: Home / History / My QR / Profile. Home draws its own greeting header; the other
 * tabs get a native header with the translated title. Lucide icons are given colors by the tab
 * bar (a color prop, so the token hex values come from @bhw/design-tokens).
 */
export default function TabsLayout() {
  const { t } = usePreferences();
  const { scheme } = useAppTheme();
  const palette = colors[scheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.mutedForeground,
        tabBarStyle: { backgroundColor: palette.card, borderTopColor: palette.border, minHeight: 56 },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 12 },
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("home"), headerShown: false, tabBarIcon: HomeIcon, tabBarAccessibilityLabel: t("home") }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t("history"), tabBarIcon: HistoryIcon, tabBarAccessibilityLabel: t("history") }}
      />
      <Tabs.Screen name="my-qr" options={{ title: t("myQr"), tabBarIcon: QrIcon, tabBarAccessibilityLabel: t("myQr") }} />
      <Tabs.Screen
        name="profile"
        options={{ title: t("profile"), tabBarIcon: ProfileIcon, tabBarAccessibilityLabel: t("profile") }}
      />
    </Tabs>
  );
}
