"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Re-runs the page's Server Components (used by dashboard error states). */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCwIcon data-icon="inline-start" className={cn(pending && "animate-spin")} aria-hidden />
      {pending ? "Retrying…" : "Try again"}
    </Button>
  );
}

/**
 * Polling refresh for the viewer dashboard: viewers do not receive Realtime rows (RLS), so the
 * page re-renders every `intervalMs` while the tab is visible, and right away when it becomes
 * visible again. `renderedAt` comes from the server render, so "Updated" is the data's time.
 */
export function PollingRefresh({ renderedAt, intervalMs = 30_000 }: { renderedAt: string; intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const id = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-2">
      <p className="text-sm text-muted-foreground tabular-nums" role="status" aria-live="polite">
        Updated {formatTime(renderedAt)}
      </p>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Refresh now"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCwIcon className={cn(pending && "animate-spin")} aria-hidden />
      </Button>
    </div>
  );
}
