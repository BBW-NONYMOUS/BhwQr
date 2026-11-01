import type { ProfileStatus } from "@bhw/types";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { PROFILE_STATUS_LABELS } from "./employee-helpers";

/** Account status colours reuse the attendance status tokens (no new hex values). */
const CLASSES: Record<ProfileStatus, string> = {
  active: "bg-status-on-time text-status-on-time-foreground",
  pending: "bg-status-late text-status-late-foreground",
  rejected: "bg-status-absent text-status-absent-foreground",
  inactive: "bg-status-incomplete text-status-incomplete-foreground",
};

export function ProfileStatusBadge({ status, className }: { status: ProfileStatus; className?: string }) {
  return (
    <Badge data-status={status} className={cn("rounded-full border-transparent", CLASSES[status], className)}>
      {PROFILE_STATUS_LABELS[status]}
    </Badge>
  );
}
