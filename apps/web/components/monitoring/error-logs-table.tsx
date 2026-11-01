"use client";

import type { ErrorSeverity, ErrorSource } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";
import { PanelRightOpenIcon } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";

import { prettyJson } from "./audit-diff";
import { SeverityBadge } from "./badges";
import { SEVERITY_LABELS, SOURCE_LABELS } from "./log-filters";

export interface ErrorLogRow {
  id: string;
  createdAt: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  context: unknown;
  userName: string | null;
  userId: string | null;
}

const SEVERITY_RANK: Record<ErrorSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };

export function ErrorLogsTable({ rows, fileName }: { rows: ErrorLogRow[]; fileName: string }) {
  const [selected, setSelected] = useState<ErrorLogRow | null>(null);

  const columns: ColumnDef<ErrorLogRow, unknown>[] = [
    {
      accessorKey: "createdAt",
      header: "Time",
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt} className="whitespace-nowrap">
          {formatDateTime(row.original.createdAt)}
        </time>
      ),
    },
    {
      id: "source",
      accessorFn: (r) => SOURCE_LABELS[r.source],
      header: "Source",
    },
    {
      id: "severity",
      accessorFn: (r) => SEVERITY_RANK[r.severity],
      header: "Severity",
      cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
    },
    {
      accessorKey: "message",
      header: "Message",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-xl whitespace-normal" title={row.original.message}>
          {row.original.message}
        </span>
      ),
    },
    {
      id: "user",
      accessorFn: (r) => r.userName ?? "",
      header: "User",
      cell: ({ row }) => row.original.userName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "details",
      header: () => <span className="sr-only">Details</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" aria-label="Show details" onClick={() => setSelected(row.original)}>
          <PanelRightOpenIcon aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search messages and users"
        emptyTitle="No errors in this range"
        emptyDescription="Nothing was logged for these filters. Widen the date range or reset the filters."
        csvFileName={fileName}
        csv={[
          { header: "Time (Manila)", value: (r) => formatDateTime(r.createdAt) },
          { header: "Source", value: (r) => SOURCE_LABELS[r.source] },
          { header: "Severity", value: (r) => SEVERITY_LABELS[r.severity] },
          { header: "Message", value: (r) => r.message },
          { header: "User", value: (r) => r.userName ?? "" },
          { header: "Context", value: (r) => JSON.stringify(r.context ?? {}) },
        ]}
        pageSize={50}
      />
      <Sheet open={selected !== null} onOpenChange={(open) => (!open ? setSelected(null) : undefined)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <SeverityBadge severity={selected.severity} />
                  {SOURCE_LABELS[selected.source]} error
                </SheetTitle>
                <SheetDescription>
                  {formatDateTime(selected.createdAt)} (Manila){selected.userName ? ` · ${selected.userName}` : ""}
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
                <div className="space-y-4">
                  <section>
                    <h3 className="mb-1 text-sm font-medium">Message</h3>
                    <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
                  </section>
                  <section>
                    <h3 className="mb-1 text-sm font-medium">Context</h3>
                    <pre className="overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs leading-relaxed">
                      {prettyJson(selected.context)}
                    </pre>
                  </section>
                  <p className="text-xs text-muted-foreground">
                    Entry ID <code className="font-mono">{selected.id}</code>
                    {selected.userId ? (
                      <>
                        {" "}
                        · User ID <code className="font-mono">{selected.userId}</code>
                      </>
                    ) : null}
                  </p>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
