import type { AttendanceStatusToken } from "@bhw/design-tokens";
import type { Lang } from "@bhw/types";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { statusLabel } from "@/lib/messages";
import { cn } from "@/lib/utils";

/**
 * Status colors from @bhw/design-tokens statusColors, exposed by the Tailwind preset as
 * `status-<name>` / `status-<name>-foreground`. Class names are spelled out in full so
 * NativeWind can see them at build time.
 */
const STATUS_CLASSES: Record<AttendanceStatusToken, { badge: string; text: string }> = {
  on_time: { badge: "bg-status-on-time", text: "text-status-on-time-foreground" },
  late: { badge: "bg-status-late", text: "text-status-late-foreground" },
  absent: { badge: "bg-status-absent", text: "text-status-absent-foreground" },
  incomplete: { badge: "bg-status-incomplete", text: "text-status-incomplete-foreground" },
  undertime: { badge: "bg-status-undertime", text: "text-status-undertime-foreground" },
};

/** Attendance status on an RN Reusables Badge (same colors in light and dark for recognisability). */
export function StatusBadge({
  status,
  lang,
  className,
}: {
  status: AttendanceStatusToken;
  lang: Lang;
  className?: string;
}) {
  const label = statusLabel(status, lang);
  return (
    <Badge
      className={cn("border-transparent px-2.5 py-1", STATUS_CLASSES[status].badge, className)}
      accessibilityLabel={label}
      testID={`status-badge-${status}`}
    >
      <Text className={cn("text-xs font-semibold", STATUS_CLASSES[status].text)}>{label}</Text>
    </Badge>
  );
}
