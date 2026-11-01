import { CORRECTION_TYPES, CORRECTION_TYPE_LABELS, type CorrectionType } from "@bhw/types";
import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/gluestack/actionsheet";
import { L } from "@/components/history/strings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";
import { cn } from "@/lib/utils";

const TYPE_HINTS: Record<CorrectionType, { en: string; fil: string }> = {
  missing_time_in: { en: "You came to work but have no time-in.", fil: "Pumasok ka pero walang time-in." },
  missing_time_out: { en: "You forgot or could not scan out.", fil: "Nakalimutan o hindi ka nakapag-scan ng time-out." },
  wrong_time: { en: "A recorded time is wrong.", fil: "Mali ang naitalang oras." },
  official_business: { en: "You were on field work or official business.", fil: "Nasa field work o opisyal na lakad ka." },
};

/** Correction type picker: trigger button + gluestack Actionsheet (gluestack's Actionsheet job). */
export function CorrectionTypePicker({
  value,
  onChange,
  lang,
  invalid,
  labelledBy,
}: {
  value: CorrectionType | null;
  onChange: (type: CorrectionType) => void;
  lang: Lang;
  invalid?: boolean;
  labelledBy?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        className={cn("min-h-touch justify-between border-input px-3", invalid && "border-destructive")}
        onPress={() => setOpen(true)}
        accessibilityLabel={value ? CORRECTION_TYPE_LABELS[value][lang] : L[lang].chooseType}
        aria-labelledby={labelledBy}
      >
        <Text className={cn("flex-1 text-left text-base font-normal text-foreground", !value && "text-muted-foreground")}>
          {value ? CORRECTION_TYPE_LABELS[value][lang] : L[lang].chooseType}
        </Text>
        <Icon as={ChevronDown} size={18} className="text-muted-foreground" />
      </Button>

      <Actionsheet isOpen={open} onClose={() => setOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="pb-8">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text className="w-full px-3 pb-2 pt-1 text-base font-semibold">{L[lang].correctionType}</Text>
          {CORRECTION_TYPES.map((type) => (
            <ActionsheetItem
              key={type}
              className="min-h-[56px]"
              accessibilityRole="button"
              accessibilityState={{ selected: value === type }}
              onPress={() => {
                onChange(type);
                setOpen(false);
              }}
            >
              <View className="flex-1">
                <ActionsheetItemText className="font-medium">{CORRECTION_TYPE_LABELS[type][lang]}</ActionsheetItemText>
                <ActionsheetItemText size="sm" className="text-muted-foreground">
                  {TYPE_HINTS[type][lang]}
                </ActionsheetItemText>
              </View>
              {value === type ? <Icon as={Check} size={18} className="text-brand" /> : null}
            </ActionsheetItem>
          ))}
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
