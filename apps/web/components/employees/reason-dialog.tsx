"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions";

import { showActionResult } from "./action-feedback";
import { reasonFormSchema, type ReasonFormInput } from "./employee-helpers";

/**
 * Confirm dialog for destructive or audited actions that need a reason of at least 10
 * characters (design spec "Feedback"; BR-13, state table §2.1, D-07). The reason is enforced
 * inline here and again by the Server Action and the SQL RPC.
 */
export function ReasonDialog({
  trigger,
  title,
  description,
  reasonLabel = "Reason",
  reasonHint,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  reasonLabel?: string;
  reasonHint?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (input: { reason: string }) => Promise<ActionResult<unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fieldId = useId();
  const form = useForm<ReasonFormInput>({
    resolver: zodResolver(reasonFormSchema),
    defaultValues: { reason: "" },
  });
  const length = (useWatch({ control: form.control, name: "reason" }) ?? "").trim().length;

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await onConfirm({ reason: values.reason });
      if (!result.ok && result.fieldErrors?.reason) {
        form.setError("reason", { message: result.fieldErrors.reason });
      }
      if (showActionResult(result)) {
        setOpen(false);
        form.reset();
      }
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="reason"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={fieldId}>{reasonLabel}</FieldLabel>
                <Textarea
                  {...field}
                  id={fieldId}
                  rows={4}
                  maxLength={500}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={`${fieldId}-hint`}
                  disabled={pending}
                />
                <FieldDescription id={`${fieldId}-hint`} className="flex justify-between gap-2">
                  <span>{reasonHint ?? "At least 10 characters. This is saved in the audit log."}</span>
                  <span className="tabular-nums" aria-live="polite">
                    {length}/500
                  </span>
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              className="h-11"
              disabled={pending}
            >
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
