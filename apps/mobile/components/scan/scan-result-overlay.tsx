import type { AttendanceStatusToken } from "@bhw/design-tokens";
import type { Lang } from "@bhw/types";
import * as Haptics from "expo-haptics";
import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { AnimatePresence, YStack } from "tamagui";

import { StatusBadge } from "@/components/home/status-badge";
import { SCAN_COPY } from "@/components/scan/copy";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";
import type { ScanResultView } from "@/lib/scan-result";

const TONE: Record<ScanResultView["tone"], { icon: LucideIcon; circle: string; fg: string }> = {
  success: { icon: CircleCheck, circle: "bg-status-on-time", fg: "text-status-on-time-foreground" },
  warning: { icon: TriangleAlert, circle: "bg-status-late", fg: "text-status-late-foreground" },
  error: { icon: CircleX, circle: "bg-status-absent", fg: "text-status-absent-foreground" },
};

const HAPTIC: Record<ScanResultView["haptic"], Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

/** Follows the OS "Remove animations / Reduce motion" setting (low-end Android rule). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduce(value);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function actionLabel(action: ScanResultView["action"], lang: Lang): string | null {
  const s = STRINGS[lang];
  switch (action) {
    case "retry":
      return s.retry;
    case "settings":
      return s.openSettings;
    case "correction":
      return s.requestCorrection;
    case "login":
      return SCAN_COPY[lang].loginAgain;
    default:
      return null;
  }
}

export interface ScanResultOverlayProps {
  /** null hides the overlay (with an exit animation). */
  view: ScanResultView | null;
  lang: Lang;
  /** Attendance status of a successful scan, shown as a badge. */
  status?: AttendanceStatusToken;
  /** Closes automatically after this many ms (successful scans only). */
  autoDismissMs?: number;
  onAction: (action: ScanResultView["action"]) => void;
  onClose: () => void;
}

/**
 * Scan Result overlay — Tamagui's job in this app (AnimatePresence + YStack enter/exit styles);
 * the content inside uses RN Reusables Text/Button/Badge like every other screen. Announced to
 * screen readers (accessibilityLiveRegion="assertive" + announceForAccessibility), with
 * success / warning / error haptics, and no animation when the OS asks to reduce motion.
 */
export function ScanResultOverlay({ view, lang, status, autoDismissMs, onAction, onClose }: ScanResultOverlayProps) {
  const reduceMotion = useReduceMotion();
  const c = SCAN_COPY[lang];

  useEffect(() => {
    if (!view) return;
    void Haptics.notificationAsync(HAPTIC[view.haptic]).catch(() => undefined);
    AccessibilityInfo.announceForAccessibility(`${view.title}. ${view.message}`);
  }, [view]);

  useEffect(() => {
    if (!view || !autoDismissMs) return;
    const timer = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(timer);
  }, [view, autoDismissMs, onClose]);

  const motion = reduceMotion
    ? {}
    : {
        transition: "quick" as const,
        enterStyle: { opacity: 0, scale: 0.92, y: 24 },
        exitStyle: { opacity: 0, scale: 0.96, y: 12 },
      };

  const tone = view ? TONE[view.tone] : null;
  const label = view ? actionLabel(view.action, lang) : null;

  return (
    <View className="absolute inset-0" pointerEvents={view ? "auto" : "none"}>
      <AnimatePresence>
        {view && tone ? (
          <YStack key="scan-result" flex={1} opacity={1} scale={1} y={0} {...motion}>
            <View
              className="flex-1 items-center justify-center gap-6 bg-background px-6"
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
              testID={`scan-result-${view.tone}`}
            >
              <View className={`h-28 w-28 items-center justify-center rounded-full ${tone.circle}`}>
                <Icon as={tone.icon} size={64} className={tone.fg} />
              </View>

              <View className="items-center gap-2">
                <Text className="text-center text-2xl font-bold" accessibilityRole="header">
                  {view.title}
                </Text>
                {status ? <StatusBadge status={status} lang={lang} /> : null}
                <Text className="text-center text-base">{view.message}</Text>
                <Text className="text-center text-sm text-muted-foreground">{view.secondary}</Text>
                {view.action === "contact_admin" ? (
                  <Text className="text-center text-sm font-medium">{STRINGS[lang].contactAdmin}</Text>
                ) : null}
              </View>

              <View className="w-full gap-3">
                {label ? (
                  <Button className="min-h-touch" onPress={() => onAction(view.action)}>
                    <Text>{label}</Text>
                  </Button>
                ) : null}
                <Button variant={label ? "outline" : "default"} className="min-h-touch" onPress={onClose}>
                  <Text>{view.tone === "error" ? c.close : c.done}</Text>
                </Button>
                {autoDismissMs ? (
                  <Text className="text-center text-xs text-muted-foreground">{c.autoClose}</Text>
                ) : null}
              </View>
            </View>
          </YStack>
        ) : null}
      </AnimatePresence>
    </View>
  );
}
