"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActionResult } from "@/lib/actions";

import { formatWorkDays, type ScheduleFormValues } from "./schedule";
import { ScheduleFormDialog, type SaveScheduleAction } from "./schedule-form-dialog";
import { WorkDayChips } from "./work-days";

export interface ScheduleRow {
  id: string;
  values: ScheduleFormValues;
  currentEmployees: number;
  everEmployees: number;
}

export type DeleteScheduleAction = (id: string) => Promise<ActionResult<undefined>>;

export function NewScheduleButton({ saveAction }: { saveAction: SaveScheduleAction }) {
  return (
    <ScheduleFormDialog
      action={saveAction}
      trigger={
        <Button>
          <PlusIcon data-icon="inline-start" aria-hidden />
          New schedule
        </Button>
      }
    />
  );
}

export function SchedulesTable({
  rows,
  saveAction,
  deleteAction,
}: {
  rows: ScheduleRow[];
  saveAction: SaveScheduleAction;
  deleteAction: DeleteScheduleAction;
}) {
  const [toDelete, setToDelete] = useState<ScheduleRow | null>(null);

  const columns: ColumnDef<ScheduleRow, unknown>[] = [
    {
      id: "name",
      accessorFn: (r) => r.values.name,
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.values.name}</span>,
    },
    {
      id: "workDays",
      accessorFn: (r) => formatWorkDays(r.values.workDays),
      header: "Work days",
      enableSorting: false,
      cell: ({ row }) => <WorkDayChips days={row.original.values.workDays} />,
    },
    {
      id: "hours",
      accessorFn: (r) => r.values.startTime,
      header: "Hours",
      cell: ({ row }) => `${row.original.values.startTime}–${row.original.values.endTime}`,
    },
    {
      id: "break",
      accessorFn: (r) => r.values.breakStart,
      header: "Break",
      cell: ({ row }) => `${row.original.values.breakStart}–${row.original.values.breakEnd}`,
    },
    {
      id: "grace",
      accessorFn: (r) => r.values.graceMinutes,
      header: "Grace",
      cell: ({ row }) => `${row.original.values.graceMinutes} min`,
    },
    {
      id: "employees",
      accessorFn: (r) => r.currentEmployees,
      header: "Employees",
      cell: ({ row }) => {
        const { currentEmployees, everEmployees } = row.original;
        return (
          <span>
            {currentEmployees}
            {everEmployees > currentEmployees ? (
              <span className="text-muted-foreground"> ({everEmployees} incl. past)</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-1">
            <ScheduleFormDialog
              action={saveAction}
              schedule={{ id: r.id, values: r.values }}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.values.name}`}>
                  <PencilIcon aria-hidden />
                </Button>
              }
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${r.values.name}`}
                  onClick={() => setToDelete(r)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {r.everEmployees > 0 ? "Assigned schedules cannot be deleted" : "Delete schedule"}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search schedules"
        emptyTitle="No schedules yet"
        emptyDescription="Create a schedule, then assign it to employees from their profile or on approval."
        csvFileName="schedules"
        csv={[
          { header: "Name", value: (r) => r.values.name },
          { header: "Work days", value: (r) => formatWorkDays(r.values.workDays) },
          { header: "Start", value: (r) => r.values.startTime },
          { header: "End", value: (r) => r.values.endTime },
          { header: "Break start", value: (r) => r.values.breakStart },
          { header: "Break end", value: (r) => r.values.breakEnd },
          { header: "Grace (min)", value: (r) => r.values.graceMinutes },
          { header: "Employees (current)", value: (r) => r.currentEmployees },
        ]}
      />
      <DeleteScheduleDialog schedule={toDelete} onClose={() => setToDelete(null)} deleteAction={deleteAction} />
    </>
  );
}

function DeleteScheduleDialog({
  schedule,
  onClose,
  deleteAction,
}: {
  schedule: ScheduleRow | null;
  onClose: () => void;
  deleteAction: DeleteScheduleAction;
}) {
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    if (!schedule) return;
    startTransition(async () => {
      const result = await deleteAction(schedule.id);
      if (result.ok) toast.success(result.message ?? "Schedule deleted.");
      else toast.error(result.message);
      onClose();
    });
  };

  return (
    <Dialog open={schedule !== null} onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{schedule?.values.name}”?</DialogTitle>
          <DialogDescription>
            {schedule && schedule.everEmployees > 0
              ? `This schedule is or was assigned to ${schedule.everEmployees} employee${schedule.everEmployees === 1 ? "" : "s"}, so the database will keep it to protect past DTRs. Create a new schedule and reassign employees instead.`
              : "This cannot be undone. The schedule has never been assigned, so no attendance record depends on it."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
