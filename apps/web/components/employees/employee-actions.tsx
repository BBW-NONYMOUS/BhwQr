"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UserRole } from "@bhw/types";
import { Loader2Icon, PencilIcon, PowerIcon, PowerOffIcon, SmartphoneIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  deactivateEmployee,
  reactivateEmployee,
  resetEmployeeDevice,
  updateEmployeeProfile,
} from "@/app/admin/employees/actions";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { showActionResult } from "./action-feedback";
import { editEmployeeSchema, editStaffSchema, type EditEmployeeInput, type StatusAction } from "./employee-helpers";
import { ReasonDialog } from "./reason-dialog";

const staffFormSchema = editStaffSchema.extend({ bhwIdNumber: z.string(), area: z.string() });

// ---------------------------------------------------------------------------
// Edit profile (FR-13)
// ---------------------------------------------------------------------------

export function EditProfileDialog({
  employee,
}: {
  employee: { id: string; role: UserRole; full_name: string; bhw_id_number: string | null; area: string | null };
}) {
  const isEmployee = employee.role === "employee";
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseId = useId();
  const defaults: EditEmployeeInput = {
    fullName: employee.full_name,
    bhwIdNumber: employee.bhw_id_number ?? "",
    area: employee.area ?? "",
  };
  const form = useForm<EditEmployeeInput, unknown, { fullName: string; bhwIdNumber: string; area: string }>({
    resolver: isEmployee ? zodResolver(editEmployeeSchema) : zodResolver(staffFormSchema),
    defaultValues: defaults,
  });

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = isEmployee ? values : { fullName: values.fullName };
      const result = await updateEmployeeProfile(employee.id, payload);
      if (!result.ok) {
        for (const key of ["fullName", "bhwIdNumber", "area"] as const) {
          const message = result.fieldErrors?.[key];
          if (message) form.setError(key, { message });
        }
        if (result.code === "BHW_ID_TAKEN") form.setError("bhwIdNumber", { message: result.message });
      }
      if (showActionResult(result)) setOpen(false);
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11">
          <PencilIcon data-icon="inline-start" aria-hidden />
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Changes are saved to the audit log with your name.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Controller
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${baseId}-name`}>Full name</FieldLabel>
                  <Input
                    {...field}
                    id={`${baseId}-name`}
                    autoComplete="off"
                    className="h-11"
                    aria-invalid={fieldState.invalid || undefined}
                    disabled={pending}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            {isEmployee ? (
              <>
                <Controller
                  control={form.control}
                  name="bhwIdNumber"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor={`${baseId}-bhw`}>BHW ID number</FieldLabel>
                      <Input
                        {...field}
                        id={`${baseId}-bhw`}
                        autoComplete="off"
                        className="h-11 uppercase"
                        aria-invalid={fieldState.invalid || undefined}
                        disabled={pending}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="area"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor={`${baseId}-area`}>Purok / area</FieldLabel>
                      <Input
                        {...field}
                        id={`${baseId}-area`}
                        autoComplete="off"
                        className="h-11"
                        aria-invalid={fieldState.invalid || undefined}
                        disabled={pending}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <FieldDescription>
                  Contact number, address and photo belong to the employee (Data Privacy Act). They update them
                  from their own profile in the app or at /me.
                </FieldDescription>
              </>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Deactivate / reactivate (FR-15)
// ---------------------------------------------------------------------------

export function StatusActionButtons({
  employeeId,
  employeeName,
  actions,
}: {
  employeeId: string;
  employeeName: string;
  actions: StatusAction[];
}) {
  return (
    <>
      {actions.includes("deactivate") ? (
        <ReasonDialog
          title={`Deactivate ${employeeName}?`}
          description="They will not be able to log in, scan, bind a phone or show a personal QR, and will not be marked absent. Their phone binding and records are kept."
          reasonLabel="Reason for deactivation"
          confirmLabel="Deactivate account"
          destructive
          onConfirm={(input) => deactivateEmployee(employeeId, input)}
          trigger={
            <Button variant="destructive" className="h-11">
              <PowerOffIcon data-icon="inline-start" aria-hidden />
              Deactivate
            </Button>
          }
        />
      ) : null}
      {actions.includes("reactivate") ? <ReactivateDialog employeeId={employeeId} employeeName={employeeName} /> : null}
    </>
  );
}

function ReactivateDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button className="h-11">
          <PowerIcon data-icon="inline-start" aria-hidden />
          Reactivate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactivate {employeeName}?</DialogTitle>
          <DialogDescription>
            They can log in and scan again from their next request. The change is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="h-11"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (showActionResult(await reactivateEmployee(employeeId))) setOpen(false);
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
            Reactivate account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Device reset (FR-32)
// ---------------------------------------------------------------------------

export function ResetDeviceButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  return (
    <ReasonDialog
      title={`Reset ${employeeName}'s phone?`}
      description="The current phone stops working for attendance right away. The next phone they log in with is registered in its place. They are notified."
      reasonLabel="Reason for reset"
      reasonHint="At least 10 characters, e.g. “Lost phone, replaced with a new unit.”"
      confirmLabel="Reset device"
      destructive
      onConfirm={(input) => resetEmployeeDevice(employeeId, input)}
      trigger={
        <Button variant="outline" className="h-11">
          <SmartphoneIcon data-icon="inline-start" aria-hidden />
          Reset device
        </Button>
      }
    />
  );
}
