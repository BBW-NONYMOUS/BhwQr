import { statusColors, type AttendanceStatusToken } from "@bhw/design-tokens";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Token-driven classes per attendance status (see packages/design-tokens/web.css). */
const STATUS_CLASSES: Record<AttendanceStatusToken, string> = {
  on_time: "bg-status-on-time text-status-on-time-foreground",
  late: "bg-status-late text-status-late-foreground",
  absent: "bg-status-absent text-status-absent-foreground",
  incomplete: "bg-status-incomplete text-status-incomplete-foreground",
  undertime: "bg-status-undertime text-status-undertime-foreground",
};

export interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, "variant" | "children"> {
  status: AttendanceStatusToken;
  /** Show the Filipino label instead of the English one. */
  filipino?: boolean;
}

export function StatusBadge({ status, filipino = false, className, ...props }: StatusBadgeProps) {
  const token = statusColors[status];
  return (
    <Badge
      data-status={status}
      className={cn("rounded-full border-transparent", STATUS_CLASSES[status], className)}
      {...props}
    >
      {filipino ? token.labelFil : token.label}
    </Badge>
  );
}
