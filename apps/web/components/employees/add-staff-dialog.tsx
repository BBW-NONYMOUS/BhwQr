"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, Loader2Icon, UserPlusIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { createStaffAccount } from "@/app/admin/employees/actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { showActionResult } from "./action-feedback";
import { ROLE_LABELS, STAFF_ROLES, staffAccountSchema, type StaffAccountInput } from "./employee-helpers";

const ROLE_HINTS: Record<(typeof STAFF_ROLES)[number], string> = {
  admin: "Full access to the admin portal.",
  kiosk: "Signs in on the office kiosk to show the rotating QR. Link it to a station in Stations & Kiosks.",
  viewer: "Read-only dashboard and reports for barangay management.",
};

const EMPTY: StaffAccountInput = { fullName: "", email: "", role: "viewer", password: "" };

/**
 * "Add staff account" (FR-14, BR-05): admin, kiosk and viewer accounts are created server-side
 * with the Supabase Admin API. Without SUPABASE_SERVICE_ROLE_KEY the button is disabled and a
 * tooltip explains why.
 */
export function AddStaffDialog({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseId = useId();
  const form = useForm<StaffAccountInput>({
    resolver: zodResolver(staffAccountSchema),
    defaultValues: EMPTY,
  });

  if (!enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Disabled buttons do not receive focus or hover, so the wrapper carries the tooltip. */}
          <span tabIndex={0} className="inline-flex rounded-md" aria-describedby={`${baseId}-why`}>
            <Button className="h-11" disabled>
              <UserPlusIcon data-icon="inline-start" aria-hidden />
              Add staff account
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent id={`${baseId}-why`} className="max-w-xs">
          Creating staff accounts needs SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local (server only). Add it
          and restart the web server.
        </TooltipContent>
      </Tooltip>
    );
  }

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createStaffAccount(values);
      if (!result.ok) {
        for (const key of ["fullName", "email", "role", "password"] as const) {
          const message = result.fieldErrors?.[key];
          if (message) form.setError(key, { message });
        }
        if (result.code === "EMAIL_TAKEN") form.setError("email", { message: result.message });
      }
      if (showActionResult(result)) {
        setOpen(false);
        form.reset(EMPTY);
        setShowPassword(false);
      }
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          form.reset(EMPTY);
          setShowPassword(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11">
          <UserPlusIcon data-icon="inline-start" aria-hidden />
          Add staff account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Add staff account</DialogTitle>
            <DialogDescription>
              For administrators, kiosks and viewers. BHW employees register themselves at /register.
            </DialogDescription>
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
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${baseId}-email`}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={`${baseId}-email`}
                    type="email"
                    autoComplete="off"
                    className="h-11"
                    aria-invalid={fieldState.invalid || undefined}
                    disabled={pending}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${baseId}-role`}>Role</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={pending}>
                    <SelectTrigger
                      id={`${baseId}-role`}
                      className="h-11 w-full data-[size=default]:h-11"
                      aria-invalid={fieldState.invalid || undefined}
                      aria-describedby={`${baseId}-role-hint`}
                      onBlur={field.onBlur}
                    >
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription id={`${baseId}-role-hint`}>
                    {field.value in ROLE_HINTS ? ROLE_HINTS[field.value as keyof typeof ROLE_HINTS] : null}
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${baseId}-password`}>Temporary password</FieldLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      id={`${baseId}-password`}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="h-11 pr-11"
                      aria-invalid={fieldState.invalid || undefined}
                      aria-describedby={`${baseId}-password-hint`}
                      disabled={pending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
                    </Button>
                  </div>
                  <FieldDescription id={`${baseId}-password-hint`}>
                    At least 8 characters. Share it privately; the account is active right away.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
