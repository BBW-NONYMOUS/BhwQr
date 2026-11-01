"use client";

import { PROFILE_STATUSES, type ProfileStatus, type UserRole } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";
import { SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

import { EmployeeAvatar } from "./employee-avatar";
import {
  PROFILE_STATUS_LABELS,
  ROLE_LABELS,
  filterEmployees,
  type EmployeeFilter,
  uniqueAreas,
} from "./employee-helpers";
import { ProfileStatusBadge } from "./profile-status-badge";

export interface EmployeeRow {
  id: string;
  full_name: string;
  bhw_id_number: string | null;
  area: string | null;
  email: string;
  status: ProfileStatus;
  photoUrl: string | null;
  device: { platform: string; model: string | null } | null;
  scheduleName: string | null;
}

function NameCell({ row }: { row: EmployeeRow }) {
  return (
    <Link
      href={`/admin/employees/${row.id}`}
      className="flex min-h-10 items-center gap-3 rounded-md font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <EmployeeAvatar name={row.full_name} photoUrl={row.photoUrl} />
      <span className="flex flex-col">
        <span className="flex flex-wrap items-center gap-2">
          {row.full_name}
          {row.photoUrl ? null : (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              No photo
            </Badge>
          )}
        </span>
        <span className="text-xs font-normal text-muted-foreground">{row.email}</span>
      </span>
    </Link>
  );
}

const columns: ColumnDef<EmployeeRow, unknown>[] = [
  {
    id: "name",
    accessorFn: (r) => `${r.full_name} ${r.email}`,
    header: "Name",
    sortingFn: (a, b) => a.original.full_name.localeCompare(b.original.full_name),
    cell: ({ row }) => <NameCell row={row.original} />,
  },
  { accessorKey: "bhw_id_number", header: "BHW ID", cell: ({ getValue }) => (getValue() as string | null) ?? "—" },
  { accessorKey: "area", header: "Purok / area", cell: ({ getValue }) => (getValue() as string | null) ?? "—" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProfileStatusBadge status={row.original.status} />,
  },
  {
    id: "device",
    accessorFn: (r) => (r.device ? "bound" : "none"),
    header: "Phone",
    enableGlobalFilter: false,
    cell: ({ row }) =>
      row.original.device ? (
        <span className="inline-flex items-center gap-1.5">
          <SmartphoneIcon className="size-4 text-primary" aria-hidden />
          <span className="capitalize">{row.original.device.platform}</span>
          <span className="sr-only">phone bound</span>
        </span>
      ) : (
        <span className="text-muted-foreground">Not bound</span>
      ),
  },
  {
    id: "schedule",
    accessorFn: (r) => r.scheduleName ?? "",
    header: "Schedule",
    cell: ({ row }) => row.original.scheduleName ?? <span className="text-muted-foreground">None</span>,
  },
];

const csv = [
  { header: "Full name", value: (r: EmployeeRow) => r.full_name },
  { header: "BHW ID number", value: (r: EmployeeRow) => r.bhw_id_number },
  { header: "Purok / area", value: (r: EmployeeRow) => r.area },
  { header: "Email", value: (r: EmployeeRow) => r.email },
  { header: "Status", value: (r: EmployeeRow) => PROFILE_STATUS_LABELS[r.status] },
  { header: "Phone bound", value: (r: EmployeeRow) => (r.device ? "Yes" : "No") },
  { header: "Phone platform", value: (r: EmployeeRow) => r.device?.platform ?? null },
  { header: "Schedule", value: (r: EmployeeRow) => r.scheduleName },
];

/** Employees list (FR-11): search, status and area filters, CSV export. */
export function EmployeesTable({
  rows,
  initialStatus = "all",
  today,
}: {
  rows: EmployeeRow[];
  initialStatus?: ProfileStatus | "all";
  today: string;
}) {
  const [filter, setFilter] = useState<EmployeeFilter>({ status: initialStatus, area: "all" });
  const areas = useMemo(() => uniqueAreas(rows), [rows]);
  const visible = useMemo(() => filterEmployees(rows, filter), [rows, filter]);

  const toolbar = (
    <>
      <Select value={filter.status} onValueChange={(status) => setFilter((f) => ({ ...f, status: status as EmployeeFilter["status"] }))}>
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {PROFILE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {PROFILE_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filter.area} onValueChange={(area) => setFilter((f) => ({ ...f, area }))}>
        <SelectTrigger className="w-44" aria-label="Filter by purok or area">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All areas</SelectItem>
          {areas.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filter.status !== "all" || filter.area !== "all" ? (
        <Badge variant="secondary" className="tabular-nums">
          {visible.length} of {rows.length}
        </Badge>
      ) : null}
    </>
  );

  return (
    <DataTable
      columns={columns}
      data={visible}
      searchPlaceholder="Search name, email or BHW ID"
      toolbar={toolbar}
      csvFileName={`bhw-employees-${today}`}
      csv={csv}
      emptyTitle={rows.length === 0 ? "No employees yet" : "No employees match these filters"}
      emptyDescription={
        rows.length === 0
          ? "BHW employees appear here after they register at /register."
          : "Choose \"All statuses\" or \"All areas\" to see everyone."
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Staff accounts (admin / kiosk / viewer)
// ---------------------------------------------------------------------------

export interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: ProfileStatus;
  created_at: string;
}

const staffColumns: ColumnDef<StaffRow, unknown>[] = [
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/admin/employees/${row.original.id}`}
        className="inline-flex min-h-10 items-center rounded-md font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {row.original.full_name}
      </Link>
    ),
  },
  { accessorKey: "email", header: "Email" },
  {
    id: "role",
    accessorFn: (r) => ROLE_LABELS[r.role],
    header: "Role",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProfileStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    enableGlobalFilter: false,
    cell: ({ row }) => formatDate(row.original.created_at),
  },
];

export function StaffTable({ rows }: { rows: StaffRow[] }) {
  return (
    <DataTable
      columns={staffColumns}
      data={rows}
      searchPlaceholder="Search staff accounts"
      emptyTitle="No staff accounts"
      emptyDescription="Administrator, kiosk and viewer accounts you create appear here."
    />
  );
}
