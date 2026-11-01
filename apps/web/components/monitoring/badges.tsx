import type { ErrorSeverity } from "@bhw/types";
import { CircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { StationHealth } from "./health";
import { SEVERITY_LABELS } from "./log-filters";

// Status colours reuse the attendance status tokens (green = on time, red = absent, amber = late,
// grey = incomplete) so no new colours are introduced. A dedicated --warning token is requested
// in the Phase 4 report.

const HEALTH_CLASSES: Record<StationHealth, string> = {
  online: "bg-status-on-time text-status-on-time-foreground",
  offline: "bg-status-absent text-status-absent-foreground",
  never: "bg-status-incomplete text-status-incomplete-foreground",
  inactive: "bg-muted text-muted-foreground",
};

const HEALTH_LABELS: Record<StationHealth, string> = {
  online: "Online",
  offline: "Offline",
  never: "Never connected",
  inactive: "Inactive",
};

export function HealthBadge({ health, className }: { health: StationHealth; className?: string }) {
  return (
    <Badge className={cn("rounded-full border-transparent", HEALTH_CLASSES[health], className)} data-health={health}>
      <CircleIcon className={cn("fill-current", health === "online" && "motion-safe:animate-pulse")} aria-hidden />
      {HEALTH_LABELS[health]}
    </Badge>
  );
}

const SEVERITY_CLASSES: Record<ErrorSeverity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  error: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  warning: "bg-status-late text-status-late-foreground",
  info: "bg-muted text-muted-foreground",
};

export function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  return (
    <Badge className={cn("rounded-full border-transparent", SEVERITY_CLASSES[severity])} data-severity={severity}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
