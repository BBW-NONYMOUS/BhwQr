import type { CorrectionStatus } from "@bhw/types";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<CorrectionStatus, { en: string; fil: string; className: string }> = {
  pending: { en: "Pending", fil: "Naghihintay", className: "bg-status-late text-status-late-foreground" },
  approved: { en: "Approved", fil: "Aprubado", className: "bg-status-on-time text-status-on-time-foreground" },
  rejected: { en: "Rejected", fil: "Tinanggihan", className: "bg-status-absent text-status-absent-foreground" },
  cancelled: {
    en: "Cancelled",
    fil: "Kinansela",
    className: "bg-status-incomplete text-status-incomplete-foreground",
  },
};

/** Status of a correction request (My Requests), English with the Filipino term. */
export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  const label = LABELS[status];
  return (
    <Badge data-status={status} className={cn("rounded-full border-transparent", label.className)}>
      {label.en}
      <span className="font-normal opacity-80">· {label.fil}</span>
    </Badge>
  );
}
