import type { Lang } from "@bhw/types";
import { Languages } from "lucide-react-native";
import { View } from "react-native";

import { AUTH_COPY } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePreferences } from "@/lib/preferences";

const OPTIONS: { value: Lang; label: string; a11y: string }[] = [
  { value: "en", label: "EN", a11y: "English" },
  { value: "fil", label: "FIL", a11y: "Filipino" },
];

/** EN / FIL switch (RN Reusables Buttons). Saved with the other preferences on the phone. */
export function LanguageToggle() {
  const { lang, setLang } = usePreferences();

  return (
    <View className="flex-row items-center gap-2" accessibilityRole="radiogroup" accessibilityLabel={AUTH_COPY[lang].language}>
      <Icon as={Languages} size={18} className="text-muted-foreground" />
      {OPTIONS.map((o) => {
        const selected = lang === o.value;
        return (
          <Button
            key={o.value}
            size="sm"
            variant={selected ? "default" : "outline"}
            className="min-h-touch min-w-touch px-3"
            onPress={() => setLang(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.a11y}
          >
            <Text>{o.label}</Text>
          </Button>
        );
      })}
    </View>
  );
}
