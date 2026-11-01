import { useFocusEffect } from "expo-router";
import { CloudOff, QrCode, ShieldAlert } from "lucide-react-native";
import { useCallback } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Spinner } from "@/components/gluestack/spinner";
import { L, friendlyError } from "@/components/history/strings";
import { usePersonalQr } from "@/components/qr/use-personal-qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";

/** Quiet zone in px (4 modules ≈ 16 px at this size) so admin webcams read the code reliably. */
const QUIET_ZONE = 16;

/** My QR (core flow 5, FR-62): rotating personal QR for the admin's fallback scan. */
export default function MyQrScreen() {
  const { lang } = usePreferences();
  const s = L[lang];
  const { width } = useWindowDimensions();
  const qr = usePersonalQr();
  const { start, stop } = qr;

  // Only request tokens while this tab is visible (saves mobile data, FR-62).
  useFocusEffect(
    useCallback(() => {
      start();
      return stop;
    }, [start, stop]),
  );

  const size = Math.min(width - 96, 300);
  const countdown = qr.countdown;
  const showQr = qr.token !== null && !qr.fatal;
  const stale = countdown?.expired ?? false;

  return (
    <ScrollView className="flex-1 bg-background-subtle" contentContainerClassName="gap-4 px-4 pb-10 pt-3">
      <Card className="items-center gap-4 py-6">
        <CardContent className="w-full items-center gap-4 px-4">
          <Text className="text-center text-base font-semibold">{s.myQrTitle}</Text>

          {qr.fatal ? (
            <View className="items-center gap-3 py-6" accessibilityLiveRegion="assertive">
              <View className="size-16 items-center justify-center rounded-full bg-status-absent">
                <Icon as={ShieldAlert} size={28} className="text-status-absent-foreground" />
              </View>
              <Text className="text-center text-base">{friendlyError(qr.errorCode ?? "INTERNAL_ERROR", lang)}</Text>
              <Text className="text-center text-sm text-muted-foreground">{STRINGS[lang].contactAdmin}</Text>
              <Button variant="outline" className="min-h-touch px-6" onPress={qr.start}>
                <Text>{STRINGS[lang].retry}</Text>
              </Button>
            </View>
          ) : showQr && qr.token ? (
            <View
              className="rounded-2xl bg-white"
              style={{ padding: 8, opacity: stale ? 0.25 : 1 }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={s.qrLabel}
              testID="personal-qr"
            >
              <QRCode value={qr.token.content} size={size} quietZone={QUIET_ZONE} color="#000000" backgroundColor="#ffffff" ecl="M" />
            </View>
          ) : (
            <View className="items-center justify-center gap-3 rounded-2xl bg-muted" style={{ width: size + 16, height: size + 16 }}>
              {qr.errorCode ? (
                <Icon as={CloudOff} size={32} className="text-muted-foreground" />
              ) : (
                <Spinner size="large" />
              )}
              <Text className="px-6 text-center text-sm text-muted-foreground">
                {qr.errorCode ? friendlyError(qr.errorCode, lang) : s.qrLoading}
              </Text>
            </View>
          )}

          {!qr.fatal && countdown ? (
            <View className="w-full gap-2" accessibilityLiveRegion="none">
              <Progress value={countdown.percent} className="h-2.5 bg-muted" indicatorClassName="bg-brand" />
              <Text className="text-center text-sm text-muted-foreground">
                {stale ? s.qrExpired : `${s.qrRefreshIn} ${countdown.secondsLeft} s`}
              </Text>
            </View>
          ) : null}

          {!qr.fatal && qr.errorCode && qr.token ? (
            <Text className="text-center text-sm text-destructive" accessibilityLiveRegion="polite">
              {friendlyError(qr.errorCode, lang)}
            </Text>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardContent className="flex-row items-start gap-3 px-4">
          <Icon as={QrCode} size={20} className="mt-0.5 text-brand" />
          <View className="flex-1 gap-1">
            <Text className="text-base font-semibold">{s.qrInstructions}</Text>
            <Text className="text-sm text-muted-foreground">{s.qrInstructionsOther}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">{s.qrNoScreenshot}</Text>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
