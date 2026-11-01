import * as DocumentPicker from "expo-document-picker";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { L } from "@/components/history/strings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";

import { checkAttachment, formatBytes, type PickedAttachment } from "./validate";

/**
 * Optional proof for a correction (expo-document-picker). Only JPG/PNG/WebP/PDF up to 5 MB are
 * accepted, matching the `correction-attachments` bucket limits; the file is uploaded on submit.
 */
export function AttachmentField({
  value,
  onChange,
  onError,
  lang,
  disabled,
}: {
  value: PickedAttachment | null;
  onChange: (file: PickedAttachment | null) => void;
  onError: (message: string | null) => void;
  lang: Lang;
  disabled?: boolean;
}) {
  const s = L[lang];

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const problem = checkAttachment({ size: asset.size, mimeType: asset.mimeType }, lang);
    if (problem) {
      onError(problem);
      return;
    }
    onError(null);
    onChange({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? "application/octet-stream" });
  };

  if (value) {
    const isPdf = value.mimeType === "application/pdf";
    return (
      <View className="min-h-touch flex-row items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
        <Icon as={isPdf ? FileText : ImageIcon} size={20} className="text-muted-foreground" />
        <View className="flex-1">
          <Text className="text-sm font-medium" numberOfLines={1}>
            {value.name}
          </Text>
          <Text className="text-xs text-muted-foreground">{formatBytes(value.size)}</Text>
        </View>
        <Pressable
          onPress={() => onChange(null)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={s.removeAttachment}
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full active:bg-accent"
        >
          <Icon as={X} size={18} />
        </Pressable>
      </View>
    );
  }

  return (
    <Button variant="outline" className="min-h-touch" onPress={() => void pick()} disabled={disabled}>
      <Icon as={Paperclip} size={16} />
      <Text>{s.attach}</Text>
    </Button>
  );
}
