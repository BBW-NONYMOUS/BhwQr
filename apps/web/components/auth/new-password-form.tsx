"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { updatePasswordAction } from "@/app/auth/auth-actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { reportClientError } from "@/lib/report-error";
import { authMessage, type BilingualText } from "./auth-messages";
import { FormStatus } from "./form-status";
import { PasswordInput } from "./password-input";
import { newPasswordSchema, type NewPasswordInput } from "./schemas";

/** New password + confirmation; the Server Action redirects to the user's home on success. */
export function NewPasswordForm() {
  const [status, setStatus] = useState<{ tone: "error"; text: BilingualText } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await updatePasswordAction(values);
        if (result && !result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            if (field === "password" || field === "confirmPassword")
              form.setError(field, { message });
          }
          setStatus({ tone: "error", text: authMessage(result.code) });
        }
      } catch (error) {
        void reportClientError(error, { action: "updatePassword" });
        setStatus({ tone: "error", text: authMessage("INTERNAL_ERROR") });
      }
    });
  });

  return (
    <div className="flex flex-col gap-6">
      <FormStatus status={status} />
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-5">
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <PasswordInput
                  {...field}
                  id="new-password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "new-password-error" : undefined}
                />
                <FieldError id="new-password-error" errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="confirm-new-password">Confirm new password</FieldLabel>
                <PasswordInput
                  {...field}
                  id="confirm-new-password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "confirm-new-password-error" : undefined}
                />
                <FieldError id="confirm-new-password-error" errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
            <KeyRound aria-hidden="true" />
            {pending ? "Saving…" : "Save new password"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
