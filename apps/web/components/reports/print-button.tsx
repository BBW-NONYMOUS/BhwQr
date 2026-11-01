"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <Button variant="outline" onClick={() => window.print()} disabled={disabled}>
      <PrinterIcon data-icon="inline-start" />
      Print
    </Button>
  );
}
