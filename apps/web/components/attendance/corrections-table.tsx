"use client";

import {
  CORRECTION_STATUSES,
  CORRECTION_TYPE_LABELS,
  CORRECTION_TYPES,
  type AttendanceMethod,
  type AttendanceStatus,
  type CorrectionStatus,
  type CorrectionType,
} from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheckIcon, EyeIcon, PaperclipIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";

import { CorrectionReviewSheet } from "./correction-review-sheet";
import { correctionFiltersToSearch, type CorrectionFilters } from "./filters";
import type { EmployeeOption } from "./manual-entry-dialog";

export interface CorrectionRecordSnapshot {
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  undertime_minutes: number;
  method: AttendanceMethod;
}

export interface CorrectionRow {
  id: string;
  employee_id: string;
  employee_name: string;
  bhw_id_number: string | null;
  work_date: string;
  type: CorrectionType;
  requested_time_in: string | null;
  requested_time_out: string | null;
  reason: string;
  attachment_path: string | null;
  /** Short-lived signed URL for the private correction-attachments bucket (FR-70). */
  attachment_url: string | null;
  status: CorrectionStatus;
  remarks: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  created_at: string;
  /** The attendance record for this employee and date as it is now. */
  record: CorrectionRecordSnapshot | null;
}

const TAB_LABELS: Record<CorrectionStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ALL = "all";

/** Correction Requests list (FR-73): status tabs with counts, type/employee filters, review sheet. */
export function CorrectionsTable({
  rows,
  counts,
  filters,
  employees,
}: {
  rows: CorrectionRow[];
  counts: Record<CorrectionStatus, number>;
  filters: CorrectionFilters;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function apply(next: Partial<CorrectionFilters>) {
    const search = correctionFiltersToSearch({ ...filters, ...next });
    startTransition(() => router.push(search ? `${pathname}?${search}` : pathname));
  }

  function openReview(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  const isPendingTab = filters.status === "pending";

  const columns: ColumnDef<CorrectionRow, unknown>[] = [
    {
      id: "employee",
      accessorFn: (r) => `${r.employee_name} ${r.bhw_id_number ?? ""}`,
      header: "Employee",
      cell: ({ row }) => (
        <div className="min-w-36">
          <div className="font-medium">{row.original.employee_name}</div>
          {row.original.bhw_id_number ? (
            <div className="text-muted-foreground text-xs">{row.original.bhw_id_number}</div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "work_date",
      header: "Work date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDate(row.original.work_date)}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{CORRECTION_TYPE_LABELS[row.original.type].en}</span>
      ),
    },
    {
      id: "requested",
      header: "Requested in / out",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatTime(row.original.requested_time_in)} /{" "}
          {formatTime(row.original.requested_time_out)}
        </span>
      ),
    },
    {
      id: "current",
      header: "Current record",
      enableSorting: false,
      cell: ({ row }) => {
        const rec = row.original.record;
        if (!rec) return <span className="text-muted-foreground">No record</span>;
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span>
              {formatTime(rec.time_in)} / {formatTime(rec.time_out)}
            </span>
            <StatusBadge status={rec.status} />
          </div>
        );
      },
    },
    {
      accessorKey: "reason",
      header: "Reason",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="line-clamp-2 block max-w-64" title={row.original.reason}>
          {row.original.reason}
        </span>
      ),
    },
    {
      id: "attachment",
      header: "Attachment",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.attachment_url ? (
          <a
            href={row.original.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <PaperclipIcon className="size-3.5" aria-hidden />
            View
            <span className="sr-only">
              {" "}
              attachment from {row.original.employee_name} (opens in a new tab)
            </span>
          </a>
        ) : row.original.attachment_path ? (
          <span className="text-muted-foreground text-xs">Unavailable</span>
        ) : (
          "—"
        ),
    },
    ...(!isPendingTab
      ? ([
          {
            accessorKey: "remarks",
            header: "Remarks",
            enableSorting: false,
            cell: ({ row }) =>
              row.original.remarks ? (
                <span
                  className="text-muted-foreground line-clamp-2 block max-w-56"
                  title={row.original.remarks}
                >
                  {row.original.remarks}
                </span>
              ) : (
                "—"
              ),
          },
        ] satisfies ColumnDef<CorrectionRow, unknown>[])
      : []),
    {
      accessorKey: isPendingTab ? "created_at" : "reviewed_at",
      header: isPendingTab ? "Filed at" : "Reviewed at",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDateTime(
            isPendingTab
              ? row.original.created_at
              : (row.original.reviewed_at ?? row.original.created_at),
          )}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant={row.original.status === "pending" ? "default" : "ghost"}
          size="sm"
          onClick={() => openReview(row.original.id)}
        >
          {row.original.status === "pending" ? (
            <ClipboardCheckIcon data-icon="inline-start" aria-hidden />
          ) : (
            <EyeIcon data-icon="inline-start" aria-hidden />
          )}
          {row.original.status === "pending" ? "Review" : "View"}
          <span className="sr-only"> request from {row.original.employee_name}</span>
        </Button>
      ),
    },
  ];

  return (
    <Tabs value={filters.status} onValueChange={(v) => apply({ status: v as CorrectionStatus })}>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="Request status">
            {CORRECTION_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className="gap-1.5">
                {TAB_LABELS[s]}
                <Badge
                  variant={s === "pending" && counts.pending > 0 ? "default" : "secondary"}
                  className="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
                >
                  {counts[s]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-busy={navigating}>
          <div className="grid gap-1.5">
            <Label htmlFor="cr-type">Type</Label>
            <Select
              value={filters.type ?? ALL}
              onValueChange={(v) => apply({ type: v === ALL ? null : (v as CorrectionType) })}
            >
              <SelectTrigger id="cr-type" className="min-w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {CORRECTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CORRECTION_TYPE_LABELS[t].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cr-employee">Employee</Label>
            <Select
              value={filters.employeeId ?? ALL}
              onValueChange={(v) => apply({ employeeId: v === ALL ? null : v })}
            >
              <SelectTrigger id="cr-employee" className="min-w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <TabsContent value={filters.status} className="pt-2">
        <div className={navigating ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={rows}
            searchPlaceholder="Search name, BHW ID, reason"
            csvFileName={`correction-requests_${filters.status}`}
            csv={[
              { header: "Employee", value: (r) => r.employee_name },
              { header: "BHW ID", value: (r) => r.bhw_id_number },
              { header: "Work date", value: (r) => r.work_date },
              { header: "Type", value: (r) => CORRECTION_TYPE_LABELS[r.type].en },
              {
                header: "Requested time-in",
                value: (r) => (r.requested_time_in ? formatTime(r.requested_time_in) : ""),
              },
              {
                header: "Requested time-out",
                value: (r) => (r.requested_time_out ? formatTime(r.requested_time_out) : ""),
              },
              { header: "Reason", value: (r) => r.reason },
              { header: "Status", value: (r) => TAB_LABELS[r.status] },
              { header: "Remarks", value: (r) => r.remarks },
              { header: "Filed at", value: (r) => formatDateTime(r.created_at) },
              {
                header: "Reviewed at",
                value: (r) => (r.reviewed_at ? formatDateTime(r.reviewed_at) : ""),
              },
            ]}
            emptyTitle={
              isPendingTab
                ? "No pending requests"
                : `No ${TAB_LABELS[filters.status].toLowerCase()} requests`
            }
            emptyDescription={
              isPendingTab
                ? "You're all caught up. New requests from employees appear here."
                : "Requests move here once they are reviewed or cancelled."
            }
          />
        </div>
      </TabsContent>

      {selected ? (
        <CorrectionReviewSheet
          key={selected.id}
          request={selected}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      ) : null}
    </Tabs>
  );
}
