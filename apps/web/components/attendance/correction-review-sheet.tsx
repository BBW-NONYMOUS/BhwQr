"use client";

import { CORRECTION_TYPE_LABELS, reviewCorrectionSchema } from "@bhw/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, CircleCheckIcon, CircleXIcon, ExternalLinkIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { reviewCorrectionAction } from "@/app/admin/corrections/actions";
import { MethodBadge } from "@/components/method-badge";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatMinutes, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { approvalBlocker, compareCorrection, type ResultTime } from "./correction-compare";
import type { CorrectionRow } from "./corrections-table";

type ReviewInput = z.input<typeof reviewCorrectionSchema>;
type ReviewOutput = z.output<typeof reviewCorrectionSchema>;

function ResultCell({ value }: { value: ResultTime }) {
  if (value.kind === "time") return <>{formatTime(value.value)}</>;
  if (value.kind === "schedule") {
    return <span className="text-muted-foreground">Schedule {value.edge === "start" ? "start" : "end"}</span>;
  }
  return <>—</>;
}

/**
 * Review sheet (FR-73, FR-74): current record vs requested times side by side, attachment,
 * and Approve (remarks optional) / Reject (remarks ≥ 10 characters).
 */
export function CorrectionReviewSheet({
  request,
  open,
  onOpenChange,
}: {
  request: CorrectionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ReviewInput, unknown, ReviewOutput>({
    resolver: zodResolver(reviewCorrectionSchema),
    defaultValues: { requestId: request.id, decision: "approved", remarks: "" },
  });
  const isPending = request.status === "pending";
  const comparison = compareCorrection(request, request.record);
  const blocker = isPending ? approvalBlocker(request, request.record) : null;
  const typeLabel = CORRECTION_TYPE_LABELS[request.type];

  function submit(decision: "approved" | "rejected") {
    form.setValue("decision", decision);
    form.clearErrors();
    void form.handleSubmit((values) => {
      startTransition(async () => {
        const result = await reviewCorrectionAction(values);
        if (result.ok) {
          toast.success(result.message ?? "Saved.");
          onOpenChange(false);
          return;
        }
        if (result.fieldErrors?.remarks) form.setError("remarks", { message: result.fieldErrors.remarks });
        form.setError("root", { message: result.message });
        toast.error(result.message);
      });
    })();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isPending ? "Review correction request" : "Correction request"}
          </SheetTitle>
          <SheetDescription>
            {request.employee_name}
            {request.bhw_id_number ? ` · ${request.bhw_id_number}` : ""} · {formatDate(request.work_date)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {typeLabel.en}
            </Badge>
            <span className="text-xs text-muted-foreground">Filed {formatDateTime(request.created_at)}</span>
          </div>

          <section aria-labelledby="cmp-heading" className="space-y-2">
            <h3 id="cmp-heading" className="text-sm font-medium">
              Current record vs requested
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">
                  Recorded times, requested times and the times after approval (Manila time)
                </caption>
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Field</span>
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Current
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Requested
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {request.status === "approved" ? "Applied" : "After approval"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.field} className="border-t">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {row.label}
                      </th>
                      <td className="px-3 py-2">{formatTime(row.current)}</td>
                      <td className="px-3 py-2">
                        {row.requested ? formatTime(row.requested) : "—"}
                        {row.ignored && isPending ? (
                          <span className="block text-xs font-normal text-muted-foreground">Not applied</span>
                        ) : null}
                      </td>
                      <td className={cn("px-3 py-2", row.changed && "font-semibold text-primary")}>
                        <span className="inline-flex items-center gap-1">
                          {row.changed ? <ArrowRightIcon className="size-3.5" aria-hidden /> : null}
                          <ResultCell value={row.after} />
                          {row.changed ? <span className="sr-only">(changed)</span> : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {request.record ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Current:</span>
                <StatusBadge status={request.record.status} />
                <MethodBadge method={request.record.method} />
                {request.record.minutes_late > 0 ? <span>Late {formatMinutes(request.record.minutes_late)}</span> : null}
                {request.record.undertime_minutes > 0 ? (
                  <span>Undertime {formatMinutes(request.record.undertime_minutes)}</span>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">There is no attendance record for this date yet.</p>
            )}
            {isPending ? (
              <p className="text-xs text-muted-foreground">
                Status, minutes late and undertime are recomputed from the schedule when you approve.
                {request.type === "official_business" && (!request.requested_time_in || !request.requested_time_out)
                  ? " Blank official business times use the schedule's start and end."
                  : ""}
                {comparison.some((r) => r.ignored)
                  ? " A missing time-in approval only sets the time-in; the requested time-out needs its own missing time-out request."
                  : ""}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="reason-heading" className="space-y-1.5">
            <h3 id="reason-heading" className="text-sm font-medium">
              Reason
            </h3>
            <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{request.reason}</p>
            {request.attachment_url ? (
              <Button variant="link" className="h-auto px-0" asChild>
                <a href={request.attachment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon data-icon="inline-start" aria-hidden />
                  Open attachment<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            ) : request.attachment_path ? (
              <p className="text-xs text-muted-foreground">The attachment could not be loaded.</p>
            ) : null}
          </section>

          {!isPending ? (
            <>
              <Separator />
              <section className="space-y-1 text-sm">
                <p>
                  <span className="capitalize">{request.status}</span>
                  {request.reviewed_at ? ` on ${formatDateTime(request.reviewed_at)}` : ""}
                  {request.reviewer_name ? ` by ${request.reviewer_name}` : ""}.
                </p>
                {request.remarks ? <p className="text-muted-foreground">Remarks: {request.remarks}</p> : null}
              </section>
            </>
          ) : (
            <>
              <Separator />
              {blocker ? (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>This request cannot be approved as filed</AlertTitle>
                  <AlertDescription>{blocker}</AlertDescription>
                </Alert>
              ) : null}
              <Controller
                control={form.control}
                name="remarks"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="review-remarks">Remarks</FieldLabel>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      id="review-remarks"
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. Verified against the office logbook."
                      aria-invalid={fieldState.invalid}
                      aria-describedby="review-remarks-help"
                    />
                    <FieldDescription id="review-remarks-help">
                      Optional when approving. Required (at least 10 characters) when rejecting. The employee sees
                      these remarks.
                    </FieldDescription>
                    {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
              {form.formState.errors.root ? <FieldError>{form.formState.errors.root.message}</FieldError> : null}
            </>
          )}
        </div>

        {isPending ? (
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="destructive" onClick={() => submit("rejected")} disabled={pending}>
              {pending && form.getValues("decision") === "rejected" ? (
                <LoaderCircleIcon className="animate-spin" data-icon="inline-start" aria-hidden />
              ) : (
                <CircleXIcon data-icon="inline-start" aria-hidden />
              )}
              Reject
            </Button>
            <Button onClick={() => submit("approved")} disabled={pending || blocker !== null}>
              {pending && form.getValues("decision") === "approved" ? (
                <LoaderCircleIcon className="animate-spin" data-icon="inline-start" aria-hidden />
              ) : (
                <CircleCheckIcon data-icon="inline-start" aria-hidden />
              )}
              Approve
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
