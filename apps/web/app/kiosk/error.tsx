"use client";

import { AlertTriangleIcon, RotateCwIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-error";

export default function KioskError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError(error, { boundary: "kiosk", digest: error.digest }, "kiosk", "critical");
  }, [error]);

  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangleIcon className="size-14 text-destructive" aria-hidden />
      <h1 className="text-3xl font-bold">The kiosk stopped working</h1>
      <p className="text-xl text-muted-foreground">Huminto ang kiosk. Pindutin ang &quot;Try again&quot;.</p>
      <Button type="button" size="lg" className="h-12 px-6 text-lg" onClick={reset}>
        <RotateCwIcon aria-hidden />
        Try again
      </Button>
    </div>
  );
}
