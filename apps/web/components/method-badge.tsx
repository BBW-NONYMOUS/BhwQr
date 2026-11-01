import { METHOD_LABELS, type AttendanceMethod } from "@bhw/types";
import { HandIcon, PencilLineIcon, QrCodeIcon, UserCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const ICONS = {
  qr: QrCodeIcon,
  fallback_personal_qr: UserCheckIcon,
  manual: HandIcon,
  correction: PencilLineIcon,
} as const;

/** How a record was written (FR-66): kiosk QR, fallback, manual entry or approved correction. */
export function MethodBadge({ method }: { method: AttendanceMethod }) {
  const Icon = ICONS[method];
  return (
    <Badge variant={method === "qr" ? "secondary" : "outline"} className="rounded-full">
      <Icon data-icon="inline-start" aria-hidden />
      {METHOD_LABELS[method]}
    </Badge>
  );
}
