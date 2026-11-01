"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-error";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, { boundary: "admin", digest: error.digest });
  }, [error]);

  return (
    <ErrorState
      message="This page could not be loaded. Please try again; if it keeps happening, check Error Logs."
      action={
        <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
