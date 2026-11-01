"use client";

import { errorMessage } from "@bhw/types";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { DownloadIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportClientError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/client";

import type { MonthOption } from "./me-utils";

/** Catalog code from a failed Edge Function call, or NETWORK_ERROR when it never reached it. */
async function errorCode(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await (error.context as Response).json();
      if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
        return body.code;
      }
    } catch {
      // Not JSON; fall through.
    }
    return "INTERNAL_ERROR";
  }
  return "NETWORK_ERROR";
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads the employee's own CSC Form 48 for a month from the generate-dtr-pdf Edge Function.
 * The browser client sends the session token; the function calls get_dtr as the employee, so
 * only their own DTR can be produced.
 */
export function DtrDownload({
  employeeId,
  bhwIdNumber,
  months,
}: {
  employeeId: string;
  bhwIdNumber: string;
  months: MonthOption[];
}) {
  const [value, setValue] = useState(months[0]?.value ?? "");
  const [busy, setBusy] = useState(false);

  async function download() {
    const option = months.find((m) => m.value === value);
    if (!option) return;
    setBusy(true);
    try {
      const { data, error } = await createClient().functions.invoke("generate-dtr-pdf", {
        body: { employeeId, year: option.year, month: option.month },
      });
      if (error) {
        const code = await errorCode(error);
        if (code === "NETWORK_ERROR") {
          toast.error("No connection. Check the internet and try again.", {
            description: "Walang koneksyon. Subukan muli.",
          });
        } else {
          toast.error(errorMessage(code, "en"), { description: errorMessage(code, "fil") });
          if (code === "INTERNAL_ERROR") void reportClientError(error, { op: "generate-dtr-pdf", value });
        }
        return;
      }
      if (!(data instanceof Blob)) {
        toast.error(errorMessage("INTERNAL_ERROR", "en"));
        void reportClientError(new Error("generate-dtr-pdf did not return a PDF"), { value });
        return;
      }
      saveBlob(data, `DTR-${bhwIdNumber}-${option.value}.pdf`);
      toast.success(`DTR for ${option.label} downloaded`);
    } catch (e) {
      toast.error(errorMessage("INTERNAL_ERROR", "en"));
      void reportClientError(e, { op: "generate-dtr-pdf", value });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="size-5 text-brand" aria-hidden />
          My DTR <span className="font-normal text-muted-foreground">· Aking DTR</span>
        </CardTitle>
        <CardDescription>Daily Time Record (CSC Form No. 48) as a PDF, ready to print.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="dtr-month">Month · Buwan</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="dtr-month" className="w-full">
              <SelectValue placeholder="Choose a month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={download} disabled={busy || !value} className="h-10">
          {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <DownloadIcon aria-hidden />}
          {busy ? "Preparing PDF…" : "Download DTR (PDF)"}
        </Button>
      </CardContent>
    </Card>
  );
}
