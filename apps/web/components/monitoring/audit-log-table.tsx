"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PanelRightOpenIcon } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { changedKeys, diffAuditRow, formatJsonValue, type DiffKind } from "./audit-diff";
import { actionLabel, tableLabel } from "./log-filters";

export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  action: string;
  tableName: string;
  recordId: string | null;
  oldData: unknown;
  newData: unknown;
}

const KIND_LABEL: Record<DiffKind, string> = {
  changed: "Changed",
  added: "Added",
  removed: "Removed",
  unchanged: "Same",
};

// Token-based highlight: amber = changed, green = added, red = removed.
const KIND_ROW: Record<DiffKind, string> = {
  changed: "bg-status-late/40",
  added: "bg-status-on-time/40",
  removed: "bg-status-absent/40",
  unchanged: "",
};
const KIND_BADGE: Record<DiffKind, string> = {
  changed: "bg-status-late text-status-late-foreground",
  added: "bg-status-on-time text-status-on-time-foreground",
  removed: "bg-status-absent text-status-absent-foreground",
  unchanged: "bg-muted text-muted-foreground",
};

export function AuditLogTable({ rows, fileName }: { rows: AuditLogRow[]; fileName: string }) {
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const columns: ColumnDef<AuditLogRow, unknown>[] = [
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
      accessorKey: "actorName",
      header: "Actor",
      cell: ({ row }) =>
        row.original.actorId ? (
          row.original.actorName
        ) : (
          <span className="text-muted-foreground">{row.original.actorName}</span>
        ),
    },
    {
      id: "action",
      accessorFn: (r) => actionLabel(r.action),
      header: "Action",
      cell: ({ row }) => (
        <Badge variant={["insert", "update", "delete"].includes(row.original.action) ? "outline" : "secondary"}>
          {actionLabel(row.original.action)}
        </Badge>
      ),
    },
    {
      id: "table",
      accessorFn: (r) => tableLabel(r.tableName),
      header: "Table",
    },
    {
      id: "record",
      accessorFn: (r) => r.recordId ?? "",
      header: "Record ID",
      enableSorting: false,
      cell: ({ row }) => (
        <code className="block max-w-48 truncate font-mono text-xs" title={row.original.recordId ?? undefined}>
          {row.original.recordId ?? "—"}
        </code>
      ),
    },
    {
      id: "changes",
      accessorFn: (r) => changedKeys(r.oldData, r.newData).join(", "),
      header: "Changed fields",
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="line-clamp-1 max-w-64 text-xs whitespace-normal text-muted-foreground">
          {String(getValue()) || "—"}
        </span>
      ),
    },
    {
      id: "details",
      header: () => <span className="sr-only">Details</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" aria-label="Show changes" onClick={() => setSelected(row.original)}>
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
        searchPlaceholder="Search actor, action, table or record"
        emptyTitle="No audit entries in this range"
        emptyDescription="Nothing was changed for these filters. Widen the date range or reset the filters."
        csvFileName={fileName}
        csv={[
          { header: "Time (Manila)", value: (r) => formatDateTime(r.createdAt) },
          { header: "Actor", value: (r) => r.actorName },
          { header: "Actor ID", value: (r) => r.actorId ?? "" },
          { header: "Action", value: (r) => r.action },
          { header: "Table", value: (r) => r.tableName },
          { header: "Record ID", value: (r) => r.recordId ?? "" },
          { header: "Changed fields", value: (r) => changedKeys(r.oldData, r.newData).join(" ") },
          { header: "Old data", value: (r) => (r.oldData === null ? "" : JSON.stringify(r.oldData)) },
          { header: "New data", value: (r) => (r.newData === null ? "" : JSON.stringify(r.newData)) },
        ]}
        pageSize={50}
      />
      <Sheet open={selected !== null} onOpenChange={(open) => (!open ? setSelected(null) : undefined)}>
        <SheetContent className="w-full gap-0 sm:max-w-2xl">
          {selected ? <AuditDetails row={selected} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AuditDetails({ row }: { row: AuditLogRow }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const diff = diffAuditRow(row.oldData, row.newData);
  const visible = showUnchanged ? diff : diff.filter((d) => d.kind !== "unchanged");
  const unchangedCount = diff.length - diff.filter((d) => d.kind !== "unchanged").length;

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {actionLabel(row.action)} · {tableLabel(row.tableName)}
        </SheetTitle>
        <SheetDescription>
          {formatDateTime(row.createdAt)} (Manila) by {row.actorName}
          {row.recordId ? (
            <>
              {" "}
              · record <code className="font-mono text-xs break-all">{row.recordId}</code>
            </>
          ) : null}
        </SheetDescription>
      </SheetHeader>
      <div className="flex items-center gap-2 px-4 pb-3">
        <Switch id="audit-show-unchanged" checked={showUnchanged} onCheckedChange={setShowUnchanged} />
        <Label htmlFor="audit-show-unchanged" className="text-sm font-normal">
          Show unchanged fields ({unchangedCount})
        </Label>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No field values changed in this entry.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((d) => (
                  <TableRow key={d.key} className={cn(KIND_ROW[d.kind])} data-kind={d.kind}>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-start gap-1">
                        <code className="font-mono text-xs font-medium">{d.key}</code>
                        <Badge className={cn("rounded-full border-transparent", KIND_BADGE[d.kind])}>
                          {KIND_LABEL[d.kind]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 align-top font-mono text-xs break-all whitespace-pre-wrap">
                      {formatJsonValue(d.before)}
                    </TableCell>
                    <TableCell className="max-w-56 align-top font-mono text-xs break-all whitespace-pre-wrap">
                      {formatJsonValue(d.after)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Encrypted personal fields appear only as “[changed]” or “[unchanged]”; their values are never stored in the
          audit trail. Audit entries cannot be edited or deleted.
        </p>
      </ScrollArea>
    </>
  );
}
