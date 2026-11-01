"use client";

import { DownloadIcon, Loader2Icon, PrinterIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-error";

import { type DtrDocument, dtrFileName } from "./dtr-utils";

/** Print (browser print stylesheet) and client-side PDF download for the DTRs on the page. */
export function DtrActions({ docs, year, month }: { docs: DtrDocument[]; year: number; month: number }) {
  const [downloading, setDownloading] = useState(false);
  const disabled = docs.length === 0;

  async function downloadPdf() {
    setDownloading(true);
    try {
      // Loaded on demand so @react-pdf/renderer stays out of the page bundle.
      const { renderDtrPdfBlob } = await import("./dtr-pdf");
      const blob = await renderDtrPdfBlob(docs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dtrFileName(docs, year, month);
      a.click();
      // Revoke after the browser has started the download.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(docs.length === 1 ? "DTR PDF downloaded." : `${docs.length} DTRs downloaded as one PDF.`);
    } catch (error) {
      toast.error("The PDF could not be created. Please try again or use Print.");
      void reportClientError(error, { feature: "dtr-pdf", year, month, count: docs.length });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => window.print()} disabled={disabled}>
        <PrinterIcon data-icon="inline-start" />
        Print
      </Button>
      <Button onClick={downloadPdf} disabled={disabled || downloading} aria-busy={downloading}>
        {downloading ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        {downloading ? "Preparing PDF…" : "Download PDF"}
      </Button>
    </>
  );
}
