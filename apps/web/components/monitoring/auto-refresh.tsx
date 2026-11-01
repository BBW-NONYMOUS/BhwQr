"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";

/**
 * Re-runs the page's Server Components every `intervalMs` (default 30 s) while the tab is visible,
 * and shows when the data was rendered ("Updated 08:15", Manila time).
 */
export function AutoRefresh({ renderedAt, intervalMs = 30_000 }: { renderedAt: string; intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-live="polite" className="tabular-nums">
        Updated <time dateTime={renderedAt}>{formatTime(renderedAt)}</time> · refreshes every {Math.round(intervalMs / 1000)} s
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        aria-label="Refresh now"
      >
        <RefreshCwIcon className={pending ? "animate-spin" : undefined} aria-hidden />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );
}
