"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { requestPasswordResetAction } from "@/app/auth/auth-actions";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { reportClientError } from "@/lib/report-error";
import { authMessage, type BilingualText } from "./auth-messages";
import { FormStatus } from "./form-status";
import { passwordResetSchema, type PasswordResetInput } from "./schemas";

const SENT_TEXT: BilingualText = {
  en: "If an account uses this email, we sent a link to reset the password. Please check your inbox and spam folder.",
  fil: "Kung may account na gumagamit ng email na ito, nagpadala kami ng link para ma-reset ang password. Pakitingnan ang inbox at spam folder.",
};

/** "Forgot password?" link that opens a small dialog and sends the Supabase reset e-mail. */
export function ForgotPasswordDialog({ getDefaultEmail }: { getDefaultEmail?: () => string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: BilingualText } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const form = useForm<PasswordResetInput>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus(null);
      form.reset({ email: getDefaultEmail?.() ?? "" });
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await requestPasswordResetAction(values);
        setStatus(
          result.ok
            ? { tone: "success", text: SENT_TEXT }
            : { tone: "error", text: authMessage(result.code) },
        );
      } catch (error) {
        void reportClientError(error, { action: "requestPasswordReset" });
        setStatus({ tone: "error", text: authMessage("INTERNAL_ERROR") });
      }
    });
  });

  const sent = status?.tone === "success";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          className="text-muted-foreground h-11 px-0 text-sm font-normal"
        >
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            Enter your email and we will send you a link to set a new password.{" "}
            <span lang="fil">
              Ilagay ang iyong email at padadalhan ka namin ng link para sa bagong password.
            </span>
          </DialogDescription>
        </DialogHeader>
        <form
          id="forgot-password-form"
          noValidate
          onSubmit={(event) => {
            // The dialog is portaled but React events still bubble to the login form; keep them apart.
            event.stopPropagation();
            void onSubmit(event);
          }}
          className="flex flex-col gap-4"
        >
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="reset-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="reset-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={sent}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "reset-email-error" : undefined}
                  className="h-11 md:text-base"
                />
                <FieldError id="reset-email-error" errors={[fieldState.error]} />
              </Field>
            )}
          />
          <FormStatus status={status} />
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11">
              {sent ? "Done" : "Cancel"}
            </Button>
          </DialogClose>
          {sent ? null : (
            <Button type="submit" form="forgot-password-form" className="h-11" disabled={pending}>
              <Mail aria-hidden="true" />
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
