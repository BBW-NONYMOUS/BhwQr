"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, MailCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { resendVerificationAction, signInAction } from "@/app/auth/auth-actions";
import { authMessage, type BilingualText } from "@/components/auth/auth-messages";
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog";
import { FormStatus } from "@/components/auth/form-status";
import { PasswordInput } from "@/components/auth/password-input";
import { loginSchema, type LoginInput } from "@/components/auth/schemas";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LOGIN_ERROR_TEXT, type LoginErrorCode } from "@/lib/auth-redirect";
import { reportClientError } from "@/lib/report-error";

type Status = { tone: "error" | "success"; title?: string; text: BilingualText } | null;

const RESENT_TEXT: BilingualText = {
  en: "If this email is waiting for verification, we sent a new link. Open it, then log in.",
  fil: "Kung naghihintay ng verification ang email na ito, nagpadala kami ng bagong link. Buksan ito, saka mag-login.",
};

function initialStatus(code?: LoginErrorCode): Status {
  if (!code) return null;
  const { title, en, fil } = LOGIN_ERROR_TEXT[code];
  return { tone: "error", title, text: { en, fil } };
}

/** E-mail + password sign-in. The Server Action redirects by status/role on success. */
export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: LoginErrorCode;
}) {
  const [status, setStatus] = useState<Status>(() => initialStatus(initialError));
  const [pending, startTransition] = useTransition();
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setStatus(null);
    setUnverifiedEmail(null);
    startTransition(async () => {
      try {
        const result = await signInAction({ ...values, next });
        if (result && !result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            if (field === "email" || field === "password") form.setError(field, { message });
          }
          form.resetField("password", { keepError: true });
          setStatus({ tone: "error", text: authMessage(result.code) });
          if (result.code === "EMAIL_NOT_CONFIRMED") setUnverifiedEmail(values.email);
        }
      } catch (error) {
        // redirect() is delivered through the action response, so anything thrown here is a real failure.
        void reportClientError(error, { action: "signIn" });
        setStatus({ tone: "error", text: authMessage("INTERNAL_ERROR") });
      }
    });
  });

  const resend = () => {
    if (!unverifiedEmail) return;
    startResend(async () => {
      try {
        const result = await resendVerificationAction({ email: unverifiedEmail });
        setStatus(
          result.ok
            ? { tone: "success", text: RESENT_TEXT }
            : { tone: "error", text: authMessage(result.code) },
        );
        if (result.ok) setUnverifiedEmail(null);
      } catch (error) {
        void reportClientError(error, { action: "resendVerification" });
        setStatus({ tone: "error", text: authMessage("INTERNAL_ERROR") });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FormStatus status={status} />
      {unverifiedEmail ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={resend}
          disabled={resending}
        >
          <MailCheck aria-hidden="true" />
          {resending ? "Sending…" : "Resend verification email"}
        </Button>
      ) : null}
      <form onSubmit={onSubmit} noValidate aria-describedby="login-help">
        <FieldGroup className="gap-5">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="juan.delacruz@gmail.com"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "login-email-error" : undefined}
                  className="h-11 md:text-base"
                />
                <FieldError id="login-email-error" errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <ForgotPasswordDialog getDefaultEmail={() => form.getValues("email")} />
                </div>
                <PasswordInput
                  {...field}
                  id="login-password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "login-password-error" : undefined}
                />
                <FieldError id="login-password-error" errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
            <LogIn aria-hidden="true" />
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </FieldGroup>
      </form>
      <p id="login-help" className="text-muted-foreground text-sm">
        Use the email and password you registered with.{" "}
        <span lang="fil">Gamitin ang email at password na ginamit mo sa pagrehistro.</span>
      </p>
    </div>
  );
}
