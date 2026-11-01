import type { Lang } from "@bhw/types";
import { Ban, Hourglass, LogOut, RefreshCw, Smartphone, UserX, type LucideIcon } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Spinner } from "@/components/gluestack/spinner";
import { AUTH_COPY, BLOCKED_COPY, type BlockedReason } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { STRINGS } from "@/lib/messages";

const ICONS: Record<BlockedReason, LucideIcon> = {
  pending: Hourglass,
  rejected: UserX,
  inactive: Ban,
  not_employee: UserX,
  device_mismatch: Smartphone,
};

/** Reasons where the situation can change on the server, so "Check again" makes sense. */
const CAN_RECHECK: ReadonlySet<BlockedReason> = new Set(["pending", "inactive", "device_mismatch"]);

export interface BlockedViewProps {
  reason: BlockedReason;
  /** Rejection reason from the administrator (profiles.rejection_reason). */
  detail?: string | null;
  lang: Lang;
  onLogout: () => void;
  onCheckAgain?: () => void;
  busy?: boolean;
}

/**
 * Blocked screen body (RN Reusables Card/Text/Button). Shows the explanation in the chosen
 * language with the other language underneath, so a BHW can always read it.
 */
export function BlockedView({ reason, detail, lang, onLogout, onCheckAgain, busy = false }: BlockedViewProps) {
  const other: Lang = lang === "en" ? "fil" : "en";
  const copy = BLOCKED_COPY[reason][lang];
  const secondary = BLOCKED_COPY[reason][other];
  const c = AUTH_COPY[lang];

  return (
    <ScrollView contentContainerClassName="flex-grow justify-center gap-6 px-4 py-8">
      <View className="items-center">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Icon as={ICONS[reason]} size={40} className="text-foreground" />
        </View>
      </View>

      <Card testID={`blocked-${reason}`}>
        <CardHeader>
          <CardTitle className="text-center text-xl" accessibilityRole="header">
            {copy.title}
          </CardTitle>
          <Text className="text-center text-sm text-muted-foreground">{secondary.title}</Text>
        </CardHeader>
        <CardContent className="gap-4">
          <Text>{copy.body}</Text>

          {reason === "rejected" && detail ? (
            <View className="gap-1 rounded-md bg-muted p-3">
              <Text className="text-xs font-semibold uppercase text-muted-foreground">{c.reasonLabel}</Text>
              <Text testID="blocked-detail">{detail}</Text>
            </View>
          ) : null}

          <View className="gap-1">
            <Text className="text-sm font-semibold">{c.whatNext}</Text>
            <Text>{copy.next}</Text>
          </View>

          <Separator />
          <Text className="text-sm text-muted-foreground">
            {secondary.body} {secondary.next}
          </Text>
        </CardContent>
      </Card>

      <View className="gap-3">
        {onCheckAgain && CAN_RECHECK.has(reason) ? (
          <Button variant="outline" className="min-h-touch" onPress={onCheckAgain} disabled={busy}>
            {busy ? <Spinner size="small" className="text-foreground" /> : <Icon as={RefreshCw} size={16} />}
            <Text>{c.checkAgain}</Text>
          </Button>
        ) : null}
        <Button className="min-h-touch" onPress={onLogout} disabled={busy} accessibilityHint={copy.title}>
          <Icon as={LogOut} size={16} className="text-primary-foreground" />
          <Text>{STRINGS[lang].logout}</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
