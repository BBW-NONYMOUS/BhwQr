"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-error";

export default function MeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError(error, { boundary: "me", digest: error.digest });
  }, [error]);

  return (
    <ErrorState
      message="Your attendance could not be loaded. Please try again. · Hindi ma-load ang iyong attendance. Subukan muli."
      action={
        <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
