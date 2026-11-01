import type { Lang } from "@bhw/types";
import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { Flashlight, FlashlightOff, X } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCAN_COPY } from "@/components/scan/copy";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";

const VIEWFINDER = 260;

function Corner({ className }: { className: string }) {
  return <View className={`absolute h-10 w-10 border-brand ${className}`} />;
}

export interface ScannerCameraProps {
  lang: Lang;
  /** Mount the camera (only after the camera permission is granted). */
  cameraReady: boolean;
  /** Scanning on/off: when false the barcode callback is detached and the preview paused. */
  scanning: boolean;
  /** Short message under the viewfinder (e.g. "That is not the attendance QR"). */
  notice?: string | null;
  onScanned: (result: BarcodeScanningResult) => void;
  onCancel: () => void;
}

/**
 * Full-screen dark camera (expo-camera CameraView, QR only) with a teal square viewfinder,
 * corner marks, hint text, torch toggle and Cancel. The camera is mounted only on this screen.
 */
export function ScannerCamera({ lang, cameraReady, scanning, notice, onScanned, onCancel }: ScannerCameraProps) {
  const insets = useSafeAreaInsets();
  const [torch, setTorch] = useState(false);
  const c = SCAN_COPY[lang];

  return (
    <View className="flex-1 bg-black">
      {cameraReady ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={scanning}
          enableTorch={torch && scanning}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanning ? onScanned : undefined}
          accessibilityLabel={STRINGS[lang].pointCamera}
        />
      ) : null}

      {/* Dimmed mask around the transparent viewfinder. */}
      <View className="absolute inset-0" pointerEvents="none">
        <View className="flex-1 bg-black/60" />
        <View className="flex-row" style={{ height: VIEWFINDER }}>
          <View className="flex-1 bg-black/60" />
          <View style={{ width: VIEWFINDER, height: VIEWFINDER }} testID="viewfinder">
            <Corner className="left-0 top-0 rounded-tl-2xl border-l-4 border-t-4" />
            <Corner className="right-0 top-0 rounded-tr-2xl border-r-4 border-t-4" />
            <Corner className="bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4" />
            <Corner className="bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4" />
          </View>
          <View className="flex-1 bg-black/60" />
        </View>
        <View className="flex-1 items-center bg-black/60 px-8 pt-6">
          <Text className="text-center text-base font-medium text-white">{STRINGS[lang].pointCamera}</Text>
          {notice ? (
            <Text className="mt-3 text-center text-sm text-white/80" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Top controls. */}
      <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }}>
        <Button variant="ghost" className="min-h-touch rounded-full bg-black/40 px-4" onPress={onCancel} accessibilityLabel={c.cancel}>
          <Icon as={X} size={20} className="text-white" />
          <Text className="text-white">{c.cancel}</Text>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-touch min-w-touch rounded-full bg-black/40"
          onPress={() => setTorch((v) => !v)}
          disabled={!cameraReady}
          accessibilityLabel={torch ? c.torchOff : c.torchOn}
          accessibilityState={{ checked: torch }}
        >
          <Icon as={torch ? FlashlightOff : Flashlight} size={22} className={torch ? "text-brand" : "text-white"} />
        </Button>
      </View>
    </View>
  );
}
