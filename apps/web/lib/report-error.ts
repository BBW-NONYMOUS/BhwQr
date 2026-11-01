"use client";

import type { ErrorSeverity } from "@bhw/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Sends a browser-side error to the log-error Edge Function (core flow 9) so it appears in
 * Admin → Error Logs. Never throws; failures are only written to the console.
 */
export async function reportClientError(
  error: unknown,
  context: Record<string, unknown> = {},
  source: "web" | "kiosk" = "web",
  severity: ErrorSeverity = "error",
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    await createClient().functions.invoke("log-error", {
      body: {
        source,
        severity,
        message: message.slice(0, 1000) || "Unknown error",
        context: { ...context, path: window.location.pathname },
      },
    });
  } catch (e) {
    console.error("reportClientError failed", e);
  }
}
