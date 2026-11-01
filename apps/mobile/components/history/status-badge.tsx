import type { AttendanceStatus, CorrectionStatus } from "@bhw/types";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { statusLabel, type Lang } from "@/lib/messages";
import { cn } from "@/lib/utils";

/** Design-token badge classes (bg-status-* / text-status-*-foreground from @bhw/design-tokens). */
const ATTENDANCE_CLASSES: Record<AttendanceStatus, { bg: string; fg: string }> = {
  on_time: { bg: "bg-status-on-time", fg: "text-status-on-time-foreground" },
  late: { bg: "bg-status-late", fg: "text-status-late-foreground" },
  absent: { bg: "bg-status-absent", fg: "text-status-absent-foreground" },
  undertime: { bg: "bg-status-undertime", fg: "text-status-undertime-foreground" },
  incomplete: { bg: "bg-status-incomplete", fg: "text-status-incomplete-foreground" },
};

export function AttendanceStatusBadge({ status, lang, className }: { status: AttendanceStatus; lang: Lang; className?: string }) {
  const c = ATTENDANCE_CLASSES[status];
  return (
    <Badge className={cn("border-transparent px-2.5 py-1", c.bg, className)}>
      <Text className={cn("text-xs font-semibold", c.fg)}>{statusLabel(status, lang)}</Text>
    </Badge>
  );
}

/** Correction request statuses reuse the attendance palette: pending = amber, approved = green, … */
const REQUEST_CLASSES: Record<CorrectionStatus, { bg: string; fg: string }> = {
  pending: ATTENDANCE_CLASSES.late,
  approved: ATTENDANCE_CLASSES.on_time,
  rejected: ATTENDANCE_CLASSES.absent,
  cancelled: ATTENDANCE_CLASSES.incomplete,
};

export const REQUEST_STATUS_LABELS: Record<CorrectionStatus, { en: string; fil: string }> = {
  pending: { en: "Pending", fil: "Naghihintay" },
  approved: { en: "Approved", fil: "Aprubado" },
  rejected: { en: "Rejected", fil: "Tinanggihan" },
  cancelled: { en: "Cancelled", fil: "Kinansela" },
};

export function RequestStatusBadge({ status, lang }: { status: CorrectionStatus; lang: Lang }) {
  const c = REQUEST_CLASSES[status];
  return (
    <Badge className={cn("border-transparent px-2.5 py-1", c.bg)}>
      <Text className={cn("text-xs font-semibold", c.fg)}>{REQUEST_STATUS_LABELS[status][lang]}</Text>
    </Badge>
  );
}
