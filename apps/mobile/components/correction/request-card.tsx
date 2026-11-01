import { CORRECTION_TYPE_LABELS } from "@bhw/types";
import { MessageSquareText, Paperclip } from "lucide-react-native";
import { View } from "react-native";

import { formatManilaDateTime, formatManilaTime, formatWorkDate } from "@/components/history/dates";
import { RequestStatusBadge } from "@/components/history/status-badge";
import { L } from "@/components/history/strings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { CorrectionRequestRow } from "@/lib/queries/requests";
import type { Lang } from "@/lib/messages";

/** One correction request on My Requests. Presentational: the screen owns the cancel dialog. */
export function RequestCard({
  request,
  lang,
  onCancel,
  cancelDisabled,
}: {
  request: CorrectionRequestRow;
  lang: Lang;
  onCancel: (request: CorrectionRequestRow) => void;
  cancelDisabled?: boolean;
}) {
  const s = L[lang];
  const typeLabel = CORRECTION_TYPE_LABELS[request.type][lang];
  const times = [
    request.requested_time_in ? `${s.in} ${formatManilaTime(request.requested_time_in)}` : null,
    request.requested_time_out ? `${s.out} ${formatManilaTime(request.requested_time_out)}` : null,
  ].filter((v): v is string => v !== null);

  return (
    <Card className="mx-4 gap-3 py-4" testID={`request-${request.id}`}>
      <CardHeader className="flex-row items-start justify-between gap-2 px-4">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold">{typeLabel}</Text>
          <Text className="text-sm text-muted-foreground">{formatWorkDate(request.work_date, lang)}</Text>
        </View>
        <RequestStatusBadge status={request.status} lang={lang} />
      </CardHeader>
      <CardContent className="gap-2 px-4">
        {times.length > 0 ? (
          <Text className="text-sm">
            <Text className="text-sm text-muted-foreground">{s.requested}: </Text>
            {times.join("  ·  ")}
          </Text>
        ) : null}
        <Text className="text-sm" numberOfLines={3}>
          {request.reason}
        </Text>
        {request.attachment_url ? (
          <View className="flex-row items-center gap-1">
            <Icon as={Paperclip} size={12} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{s.hasAttachment}</Text>
          </View>
        ) : null}
        {request.remarks ? (
          <View className="flex-row items-start gap-2 rounded-md bg-muted px-3 py-2">
            <Icon as={MessageSquareText} size={14} className="mt-0.5 text-muted-foreground" />
            <Text className="flex-1 text-sm">
              <Text className="text-sm font-medium">{s.adminRemarks}: </Text>
              {request.remarks}
            </Text>
          </View>
        ) : null}
        <Text className="text-xs text-muted-foreground">
          {s.filedOn} {formatManilaDateTime(request.created_at, lang)}
        </Text>
        {request.status === "pending" ? (
          <Button
            variant="outline"
            className="mt-1 min-h-touch border-destructive/40"
            onPress={() => onCancel(request)}
            disabled={cancelDisabled}
            accessibilityLabel={`${s.cancelRequest}: ${typeLabel}, ${formatWorkDate(request.work_date, lang)}`}
          >
            <Text className="text-destructive">{s.cancelRequest}</Text>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
