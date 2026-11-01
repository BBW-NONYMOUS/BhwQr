"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

import { applyFieldErrors, numberInputValue } from "./form-utils";
import {
  DEFAULT_SCHEDULE,
  WEEKDAYS,
  scheduleFormSchema,
  scheduledMinutes,
  toggleWorkDay,
  type ScheduleFormValues,
} from "./schedule";

export type SaveScheduleAction = (input: {
  id: string | null;
  values: ScheduleFormValues;
}) => Promise<ActionResult<{ id: string }>>;

const FIELDS = ["name", "workDays", "startTime", "endTime", "breakStart", "breakEnd", "graceMinutes"] as const;

interface ScheduleFormDialogProps {
  action: SaveScheduleAction;
  /** Present when editing. */
  schedule?: { id: string; values: ScheduleFormValues };
  trigger: ReactNode;
}

export function ScheduleFormDialog({ action, schedule, trigger }: ScheduleFormDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit schedule" : "New schedule"}</DialogTitle>
          <DialogDescription>
            Office hours used to compute late and undertime. Changes apply to new scans; past records
            change only when you recompute.
          </DialogDescription>
        </DialogHeader>
        {open ? <ScheduleForm action={action} schedule={schedule} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({
  action,
  schedule,
  onDone,
}: {
  action: SaveScheduleAction;
  schedule?: { id: string; values: ScheduleFormValues };
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: schedule?.values ?? DEFAULT_SCHEDULE,
    mode: "onTouched",
  });
  const times = useWatch({ control: form.control, name: ["startTime", "endTime", "breakStart", "breakEnd"] });
  const [startTime, endTime, breakStart, breakEnd] = times;
  const parsedTimes = scheduleFormSchema.safeParse({ ...DEFAULT_SCHEDULE, name: "xx", startTime, endTime, breakStart, breakEnd });
  const workMinutes = parsedTimes.success ? scheduledMinutes({ startTime, endTime, breakStart, breakEnd }) : null;

  const onSubmit = (values: ScheduleFormValues) =>
    startTransition(async () => {
      const result = await action({ id: schedule?.id ?? null, values });
      if (!result.ok) {
        applyFieldErrors(form.setError, result, FIELDS);
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Schedule saved.");
      onDone();
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="schedule-name">Name</FieldLabel>
              <Input
                {...field}
                id="schedule-name"
                placeholder="Regular Mon–Fri 8–5"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <Controller
          name="workDays"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid} className="gap-3">
              <FieldLegend variant="label">Work days</FieldLegend>
              <div role="group" aria-label="Work days" className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = field.value.includes(d.iso);
                  return (
                    <Button
                      key={d.iso}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      aria-label={d.long}
                      className={cn("w-12", on && "bg-brand text-brand-foreground hover:bg-brand/90")}
                      onClick={() => field.onChange(toggleWorkDay(field.value, d.iso))}
                      onBlur={field.onBlur}
                    >
                      {d.short}
                    </Button>
                  );
                })}
              </div>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error ?? { message: "Choose valid work days" }]} />
              ) : (
                <FieldDescription>Days without a scan on these days are marked absent (except holidays).</FieldDescription>
              )}
            </FieldSet>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TimeField form={form} name="startTime" label="Start time" />
          <TimeField form={form} name="endTime" label="End time" />
          <TimeField form={form} name="breakStart" label="Break start" />
          <TimeField form={form} name="breakEnd" label="Break end" />
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {workMinutes !== null && workMinutes > 0
            ? `Scheduled work time: ${formatMinutes(workMinutes)} per day (break excluded). The break splits AM and PM on the DTR.`
            : "The break must be inside work hours."}
        </p>

        <Controller
          name="graceMinutes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="sm:max-w-[50%]">
              <FieldLabel htmlFor="schedule-grace">Grace period (minutes)</FieldLabel>
              <Input
                id="schedule-grace"
                name={field.name}
                ref={field.ref}
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                step={1}
                value={numberInputValue(field.value)}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
                className="tabular-nums"
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>0–60. A time-in up to start + grace counts as on time.</FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : schedule ? "Save changes" : "Create schedule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TimeField({
  form,
  name,
  label,
}: {
  form: UseFormReturn<ScheduleFormValues>;
  name: "startTime" | "endTime" | "breakStart" | "breakEnd";
  label: string;
}) {
  const id = `schedule-${name}`;
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            {...field}
            id={id}
            type="time"
            step={60}
            aria-invalid={fieldState.invalid}
            onChange={(e) => {
              field.onChange(e.target.value);
              // Cross-field rules: re-check the related times once the form has been validated.
              if (form.formState.isSubmitted) void form.trigger(["startTime", "endTime", "breakStart", "breakEnd"]);
            }}
            className="tabular-nums"
          />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}
