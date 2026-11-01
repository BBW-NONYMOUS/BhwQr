import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BilingualText } from "./auth-messages";

/**
 * Form-level status message (English with Filipino below). The wrapper is always rendered so
 * screen readers announce changes through the polite live region.
 */
export function FormStatus({
  status,
  className,
}: {
  status: { tone: "error" | "success"; title?: string; text: BilingualText } | null;
  className?: string;
}) {
  return (
    <div aria-live="polite" aria-atomic="true" className={className}>
      {status ? (
        <Alert variant={status.tone === "error" ? "destructive" : "default"} role="status">
          {status.tone === "error" ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          {status.title ? <AlertTitle>{status.title}</AlertTitle> : null}
          <AlertDescription>
            <p>{status.text.en}</p>
            <p lang="fil" className="text-muted-foreground">
              {status.text.fil}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
