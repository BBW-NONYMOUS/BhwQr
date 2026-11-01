"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLinkIcon, MapPinIcon, MonitorIcon, PencilIcon, PlusIcon } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { HealthBadge } from "@/components/monitoring/badges";
import { classifyStation, formatRelative, type StationHealth } from "@/components/monitoring/health";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import { StationFormDialog, type KioskAccount, type SaveStationAction } from "./station-form-dialog";
import { formatCoords, osmUrl, radiusLabel, type StationFormValues } from "./station";

export interface StationRow {
  id: string;
  values: StationFormValues;
  isOnline: boolean;
  lastSeenAt: string | null;
  kioskName: string | null;
  kioskEmail: string | null;
}

interface StationsTableProps {
  rows: StationRow[];
  kioskAccounts: KioskAccount[];
  defaultRadiusM: number;
  heartbeatIntervalSeconds: number;
  /** Server render time, so relative times are stable during hydration. */
  nowMs: number;
  saveAction: SaveStationAction;
}

/** Kiosk accounts for the Select, marking those already linked to a different station. */
function accountsFor(all: KioskAccount[], rows: StationRow[], editingId: string | null): KioskAccount[] {
  return all.map((k) => {
    const linked = rows.find((r) => r.values.kioskUserId === k.id && r.id !== editingId);
    return { ...k, linkedStation: linked ? linked.values.name : null };
  });
}

export function NewStationButton({
  rows,
  kioskAccounts,
  defaultRadiusM,
  saveAction,
}: Pick<StationsTableProps, "rows" | "kioskAccounts" | "defaultRadiusM" | "saveAction">) {
  return (
    <StationFormDialog
      action={saveAction}
      kioskAccounts={accountsFor(kioskAccounts, rows, null)}
      defaultRadiusM={defaultRadiusM}
      trigger={
        <Button>
          <PlusIcon data-icon="inline-start" aria-hidden />
          New station
        </Button>
      }
    />
  );
}

export function StationsTable({
  rows,
  kioskAccounts,
  defaultRadiusM,
  heartbeatIntervalSeconds,
  nowMs,
  saveAction,
}: StationsTableProps) {
  const healthOf = (r: StationRow): StationHealth =>
    classifyStation(
      { is_active: r.values.isActive, is_online: r.isOnline, last_seen_at: r.lastSeenAt },
      nowMs,
      heartbeatIntervalSeconds,
    );

  const columns: ColumnDef<StationRow, unknown>[] = [
    {
      id: "name",
      accessorFn: (r) => r.values.name,
      header: "Name",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.original.values.name}</span>
          <a
            href={`/kiosk/${row.original.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <MonitorIcon className="size-3" aria-hidden />
            Open kiosk
            <span className="sr-only">for {row.original.values.name} (opens in a new tab)</span>
          </a>
        </div>
      ),
    },
    {
      id: "coordinates",
      accessorFn: (r) => formatCoords(r.values.latitude, r.values.longitude),
      header: "Coordinates",
      enableSorting: false,
      cell: ({ row }) => {
        const { latitude, longitude, name } = row.original.values;
        return (
          <a
            href={osmUrl(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <MapPinIcon className="size-3.5 text-muted-foreground" aria-hidden />
            {formatCoords(latitude, longitude)}
            <ExternalLinkIcon className="size-3 text-muted-foreground" aria-hidden />
            <span className="sr-only">Map of {name} on OpenStreetMap (opens in a new tab)</span>
          </a>
        );
      },
    },
    {
      id: "radius",
      accessorFn: (r) => r.values.radiusM ?? defaultRadiusM,
      header: "Radius",
      cell: ({ row }) => (
        <span className={row.original.values.radiusM === null ? "text-muted-foreground" : undefined}>
          {radiusLabel(row.original.values.radiusM, defaultRadiusM)}
        </span>
      ),
    },
    {
      id: "active",
      accessorFn: (r) => (r.values.isActive ? 1 : 0),
      header: "Active",
      cell: ({ row }) =>
        row.original.values.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>,
    },
    {
      id: "status",
      accessorFn: (r) => healthOf(r),
      header: "Status",
      cell: ({ row }) => <HealthBadge health={healthOf(row.original)} />,
    },
    {
      id: "lastSeen",
      accessorFn: (r) => r.lastSeenAt ?? "",
      header: "Last seen",
      cell: ({ row }) =>
        row.original.lastSeenAt ? (
          <time dateTime={row.original.lastSeenAt} title={formatDateTime(row.original.lastSeenAt)}>
            {formatRelative(row.original.lastSeenAt, nowMs)}
          </time>
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
    {
      id: "kiosk",
      accessorFn: (r) => r.kioskName ?? "",
      header: "Kiosk account",
      cell: ({ row }) =>
        row.original.kioskName ? (
          <div className="flex flex-col">
            <span>{row.original.kioskName}</span>
            {row.original.kioskEmail ? (
              <span className="text-xs text-muted-foreground">{row.original.kioskEmail}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">Not linked</span>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <StationFormDialog
            action={saveAction}
            station={{ id: row.original.id, values: row.original.values }}
            kioskAccounts={accountsFor(kioskAccounts, rows, row.original.id)}
            defaultRadiusM={defaultRadiusM}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.original.values.name}`}>
                <PencilIcon aria-hidden />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search stations"
      emptyTitle="No stations yet"
      emptyDescription="Add the BHW Office kiosk with its coordinates, then link the kiosk account that signs in on the tablet."
      csvFileName="stations"
      csv={[
        { header: "Name", value: (r) => r.values.name },
        { header: "Latitude", value: (r) => r.values.latitude },
        { header: "Longitude", value: (r) => r.values.longitude },
        { header: "Radius (m)", value: (r) => r.values.radiusM ?? `default (${defaultRadiusM})` },
        { header: "Active", value: (r) => (r.values.isActive ? "Yes" : "No") },
        { header: "Status", value: (r) => healthOf(r) },
        { header: "Last seen", value: (r) => (r.lastSeenAt ? formatDateTime(r.lastSeenAt) : "Never") },
        { header: "Kiosk account", value: (r) => r.kioskName ?? "" },
      ]}
    />
  );
}
