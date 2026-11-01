import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { CameraView } from "expo-camera";
import { File } from "expo-file-system";
import { useRef, useState } from "react";
import { View } from "react-native";

import { Spinner } from "@/components/gluestack/spinner";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { reportError } from "@/lib/api";
import type { Lang } from "@/lib/messages";
import { getSupabase } from "@/lib/supabase";

const COPY = {
  en: {
    title: "Take a selfie",
    hint: "The office requires a photo with each scan. Look at the camera, then tap Capture.",
    capture: "Capture",
    uploading: "Saving photo…",
    failed: "The photo could not be saved. Please try again.",
    cancel: "Cancel",
  },
  fil: {
    title: "Kumuha ng selfie",
    hint: "Kailangan ng opisina ang larawan sa bawat scan. Tumingin sa camera, saka pindutin ang Kunan.",
    capture: "Kunan",
    uploading: "Sine-save ang larawan…",
    failed: "Hindi na-save ang larawan. Pakisubukang muli.",
    cancel: "Kanselahin",
  },
} as const;

/** app_settings.selfie_required (optional presentation-attack check, FR-57). */
export function useSelfieRequired() {
  return useQuery({
    queryKey: ["app_settings", "selfie_required"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("app_settings").select("selfie_required").eq("id", 1).single();
      if (error) throw error;
      return data.selfie_required;
    },
    staleTime: 60_000,
  });
}

/** Storage path for a selfie: own folder (storage RLS), per Manila day, unique name. */
export function selfiePath(userId: string, manilaDate: string, id: string): string {
  return `${userId}/${manilaDate}/${id}.jpg`;
}

/**
 * Front-camera selfie taken BEFORE the QR scan, so it never eats into the 30-second QR lifetime.
 * Uploaded to the private `selfies` bucket (kept 30 days, D-32); only the path is sent with the scan.
 */
export function SelfieCapture({
  lang,
  userId,
  manilaDate,
  onCaptured,
  onCancel,
}: {
  lang: Lang;
  userId: string;
  manilaDate: string;
  onCaptured: (path: string) => void;
  onCancel: () => void;
}) {
  const c = COPY[lang];
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.4, skipProcessing: true });
      if (!photo?.uri) throw new Error("No photo");
      const path = selfiePath(userId, manilaDate, randomUUID());
      const bytes = await new File(photo.uri).bytes();
      const { error: uploadError } = await getSupabase()
        .storage.from("selfies")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      onCaptured(path);
    } catch (e) {
      setError(c.failed);
      void reportError("Selfie capture failed", { error: e instanceof Error ? e.message : String(e) }, "warning");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="absolute inset-0 bg-black" accessibilityViewIsModal>
      <CameraView ref={camera} style={{ flex: 1 }} facing="front" />
      <View className="absolute inset-x-0 bottom-0 gap-3 bg-black/70 p-6 pb-10">
        <Text className="text-xl font-semibold text-white">{c.title}</Text>
        <Text className="text-white/80">{c.hint}</Text>
        {error ? (
          <Text className="text-destructive" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
        {busy ? (
          <View className="min-h-touch flex-row items-center gap-3">
            <Spinner className="text-brand" />
            <Text className="text-white">{c.uploading}</Text>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Button variant="outline" className="min-h-touch flex-1" onPress={onCancel}>
              <Text>{c.cancel}</Text>
            </Button>
            <Button className="min-h-touch flex-1 bg-brand" onPress={() => void capture()} accessibilityLabel={c.capture}>
              <Text className="text-brand-foreground">{c.capture}</Text>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}
