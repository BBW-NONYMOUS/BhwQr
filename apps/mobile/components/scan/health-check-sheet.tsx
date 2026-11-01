import type { Lang } from "@bhw/types";
import { Check, X } from "lucide-react-native";
import { View } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/gluestack/actionsheet";
import { Spinner } from "@/components/gluestack/spinner";
import { fill } from "@/components/home/copy";
import { SCAN_COPY } from "@/components/scan/copy";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type { HealthInputs, HealthItem, HealthItemKey } from "@/lib/health-check";
import { errorMessage, STRINGS, type StringKey } from "@/lib/messages";

const LABEL: Record<HealthItemKey, StringKey> = {
  camera: "healthCamera",
  location: "healthLocation",
  gps: "healthGps",
  internet: "healthInternet",
  device: "healthDevice",
};

function detailFor(item: HealthItem, inputs: HealthInputs, lang: Lang): string {
  const c = SCAN_COPY[lang];
  if (item.state === "fail") return errorMessage(item.code ?? "INTERNAL_ERROR", lang, item.params ?? {});
  if (item.key === "gps") {
    if (inputs.accuracy === null || item.state === "pending") return c.gpsWaiting;
    return fill(c.gpsLive, { accuracy: Math.round(inputs.accuracy), max: inputs.maxAccuracy });
  }
  if (item.state === "pending") return c.checking;
  if (item.key === "device") return c.deviceOk;
  return "";
}

/** Which failures have a one-tap fix (the device check needs the administrator instead). */
function fixLabel(item: HealthItem, lang: Lang): string | null {
  if (item.state !== "fail" || item.key === "device") return null;
  if (item.key === "gps" && item.code === "GPS_INACCURATE") return STRINGS[lang].retry;
  return SCAN_COPY[lang].fix;
}

function StateMark({ item }: { item: HealthItem }) {
  if (item.state === "pending") {
    return (
      <View className="h-8 w-8 items-center justify-center">
        <Spinner size="small" className="text-muted-foreground" />
      </View>
    );
  }
  const ok = item.state === "ok";
  return (
    <View className={ok ? "h-8 w-8 items-center justify-center rounded-full bg-status-on-time" : "h-8 w-8 items-center justify-center rounded-full bg-status-absent"}>
      <Icon
        as={ok ? Check : X}
        size={18}
        className={ok ? "text-status-on-time-foreground" : "text-status-absent-foreground"}
      />
    </View>
  );
}

export interface HealthCheckSheetProps {
  isOpen: boolean;
  lang: Lang;
  items: HealthItem[];
  inputs: HealthInputs;
  ready: boolean;
  onFix: (item: HealthItem) => void;
  onStart: () => void;
  onCancel: () => void;
}

/** "Before you scan" (gluestack Actionsheet): camera, location, GPS accuracy, internet, phone. */
export function HealthCheckSheet({ isOpen, lang, items, inputs, ready, onFix, onStart, onCancel }: HealthCheckSheetProps) {
  const s = STRINGS[lang];
  const c = SCAN_COPY[lang];
  const gpsFailing = items.some((i) => i.key === "gps" && i.code === "GPS_INACCURATE");

  return (
    <Actionsheet isOpen={isOpen} onClose={onCancel}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-card px-4 pb-6">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <View className="w-full gap-1 pb-2 pt-1">
          <Text className="text-xl font-semibold" accessibilityRole="header">
            {s.healthTitle}
          </Text>
          <Text className="text-sm text-muted-foreground">{c.healthIntro}</Text>
        </View>

        <View className="w-full">
          {items.map((item, i) => {
            const label = s[LABEL[item.key]];
            const detail = detailFor(item, inputs, lang);
            const fix = fixLabel(item, lang);
            return (
              <View key={item.key}>
                {i > 0 ? <Separator /> : null}
                <View
                  className="min-h-touch flex-row items-center gap-3 py-3"
                  testID={`health-${item.key}-${item.state}`}
                >
                  <View accessible accessibilityLabel={`${label}: ${detail || item.state}`} className="flex-1 flex-row items-center gap-3">
                    <StateMark item={item} />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium">{label}</Text>
                      {detail ? (
                        <Text className={item.state === "fail" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                          {detail}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {fix ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-touch"
                      onPress={() => onFix(item)}
                      accessibilityLabel={`${fix}: ${label}`}
                    >
                      <Text>{fix}</Text>
                    </Button>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {gpsFailing ? <Text className="w-full pt-1 text-sm text-muted-foreground">{c.gpsTip}</Text> : null}

        <View className="w-full gap-3 pt-4">
          <Button
            className="min-h-touch bg-brand"
            onPress={onStart}
            disabled={!ready}
            accessibilityState={{ disabled: !ready }}
            testID="start-scanning"
          >
            <Text className="text-brand-foreground">{s.startScan}</Text>
          </Button>
          <Button variant="ghost" className="min-h-touch" onPress={onCancel}>
            <Text>{c.cancel}</Text>
          </Button>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  );
}
