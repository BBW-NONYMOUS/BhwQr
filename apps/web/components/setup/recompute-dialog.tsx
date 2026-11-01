"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions";

import { applyFieldErrors } from "./form-utils";
import { recomputeRangeSchema, type RecomputeRange } from "./schedule";

export type RecomputeAction = (range: RecomputeRange) => Promise<ActionResult<number>>;

interface RecomputeDialogProps {
  action: RecomputeAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRange: RecomputeRange;
  /** Why the admin may want to recompute (shown under the title). */
  description?: string;
}

/**
 * Runs recompute_attendance(p_from, p_to) for every employee. Statuses, minutes late and undertime
 * are recalculated from the schedule and holidays in effect; the RPC is audited (D-19, FR-106).
 */
export function RecomputeDialog({ action, open, onOpenChange, defaultRange, description }: RecomputeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recompute attendance statuses</DialogTitle>
          <DialogDescription>
            {description ??
              "Recalculates on time, late, undertime and absent for every employee in the date range using the schedules and holidays in effect now."}
          </DialogDescription>
        </DialogHeader>
        {open ? <RecomputeForm action={action} defaultRange={defaultRange} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RecomputeForm({
  action,
  defaultRange,
  onDone,
}: {
  action: RecomputeAction;
  defaultRange: RecomputeRange;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<RecomputeRange>({
    resolver: zodResolver(recomputeRangeSchema),
    defaultValues: defaultRange,
  });

  const onSubmit = (values: RecomputeRange) =>
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        applyFieldErrors(form.setError, result, ["from", "to"]);
        toast.error(result.message);
        return;
      }
      toast.success(
        result.data === 0
          ? "Recompute finished. No records needed changes."
          : `Recompute finished. ${result.data} record${result.data === 1 ? "" : "s"} updated.`,
      );
      onDone();
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="from"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="recompute-from">From</FieldLabel>
                <Input {...field} id="recompute-from" type="date" aria-invalid={fieldState.invalid} />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="to"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="recompute-to">To</FieldLabel>
                <Input {...field} id="recompute-to" type="date" aria-invalid={fieldState.invalid} />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        </div>
        <FieldDescription>
          At most 366 days. Manual entries and approved corrections keep their times; only statuses and
          minutes are recalculated. The run is recorded in the Audit Log.
        </FieldDescription>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <RefreshCwIcon data-icon="inline-start" className={pending ? "animate-spin" : undefined} aria-hidden />
          {pending ? "Recomputing…" : "Recompute"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Header button that opens the recompute dialog with a default range. */
export function RecomputeButton({
  action,
  defaultRange,
  description,
}: {
  action: RecomputeAction;
  defaultRange: RecomputeRange;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCwIcon data-icon="inline-start" aria-hidden />
        Recompute statuses
      </Button>
      <RecomputeDialog
        action={action}
        open={open}
        onOpenChange={setOpen}
        defaultRange={defaultRange}
        description={description}
      />
    </>
  );
}
