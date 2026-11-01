"use client";

import { registrationSchema, type Registration, type RegistrationInput } from "@bhw/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, ImageUp, Trash2, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
} from "react";
import { Controller, useForm, type Control } from "react-hook-form";

import { attachRegistrationPhotoAction, registerAction } from "@/app/auth/auth-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { uploadOwnPhoto } from "@/lib/own-photo";
import { checkPhotoFile } from "@/lib/registration-photo";
import { reportClientError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AuthHeading } from "./auth-heading";
import { authMessage, type BilingualText } from "./auth-messages";
import { FormStatus } from "./form-status";
import { PasswordInput } from "./password-input";
import { CONSENT_TEXT } from "./privacy-notice";
import { RegisterSuccess } from "./register-success";
import { PUROK_SUGGESTIONS, type RegisterResult } from "./schemas";

type TextFieldName = "fullName" | "bhwIdNumber" | "area" | "contactNumber" | "address" | "email";
type FormFieldName = TextFieldName | "password" | "confirmPassword" | "consent";

const FORM_FIELDS: readonly FormFieldName[] = [
  "fullName",
  "bhwIdNumber",
  "area",
  "contactNumber",
  "address",
  "email",
  "password",
  "confirmPassword",
  "consent",
];

/** Step 1 collects who the BHW is; step 2 creates the login. The photo belongs to step 1. */
const PERSONAL_FIELDS = [
  "fullName",
  "bhwIdNumber",
  "contactNumber",
  "area",
  "address",
] as const satisfies readonly FormFieldName[];

const STEPS = ["Personal details", "Account"] as const;

type Step = 0 | 1;

function isFormField(name: string): name is FormFieldName {
  return (FORM_FIELDS as readonly string[]).includes(name);
}

function isPersonalField(name: string): boolean {
  return name === "photo" || (PERSONAL_FIELDS as readonly string[]).includes(name);
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <nav aria-label="Registration progress">
      <p className="sr-only" aria-live="polite">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>
      <ol className="grid grid-cols-2 gap-3">
        {STEPS.map((title, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li
              key={title}
              aria-current={current ? "step" : undefined}
              className="flex flex-col gap-2"
            >
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done || current ? "bg-primary" : "bg-muted",
                )}
              />
              <div className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    done && "border-primary bg-primary text-primary-foreground",
                    current && "border-primary text-foreground",
                    !done && !current && "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={cn("font-medium", !done && !current && "text-muted-foreground")}>
                  {title}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface ChosenPhoto {
  file: File;
  url: string;
}

export interface RegistrationOutcome extends RegisterResult {
  photoSaved: boolean;
}

function TextField({
  control,
  name,
  label,
  hint,
  optional = false,
  ...inputProps
}: {
  control: Control<RegistrationInput, unknown, Registration>;
  name: TextFieldName;
  label: string;
  hint?: { en: string; fil: string };
  optional?: boolean;
} & Omit<ComponentProps<typeof Input>, "name" | "id">) {
  const id = `register-${name}`;
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>
            {label}
            {optional ? (
              <span className="text-muted-foreground font-normal">(optional)</span>
            ) : null}
          </FieldLabel>
          <Input
            {...inputProps}
            {...field}
            value={field.value ?? ""}
            id={id}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              [hint ? `${id}-hint` : null, fieldState.error ? `${id}-error` : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className="h-11 md:text-base"
          />
          {hint ? (
            <FieldDescription id={`${id}-hint`}>
              {hint.en} <span lang="fil">{hint.fil}</span>
            </FieldDescription>
          ) : null}
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Self-registration for Barangay Health Workers (core flow 1, FR-01..FR-10). */
export function RegisterForm() {
  const [status, setStatus] = useState<{ tone: "error"; text: BilingualText } | null>(null);
  const [outcome, setOutcome] = useState<RegistrationOutcome | null>(null);
  const [photo, setPhoto] = useState<ChosenPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(0);
  // Focus can only move once the other step is visible, so it is queued until after the render.
  const pendingFocus = useRef<(() => void) | null>(null);
  const personalStepRef = useRef<HTMLDivElement>(null);
  const accountStepRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const purokListId = useId();

  const form = useForm<RegistrationInput, unknown, Registration>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
    // Errors may sit on the hidden step; revealFirstError switches steps before focusing.
    shouldFocusError: false,
    defaultValues: {
      fullName: "",
      bhwIdNumber: "",
      area: "",
      contactNumber: "",
      address: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Free the preview's object URL when the photo changes or the form unmounts.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  useEffect(() => {
    const focus = pendingFocus.current;
    pendingFocus.current = null;
    focus?.();
  }, [step]);

  function goToStep(next: Step, focus: () => void) {
    if (next === step) {
      focus();
      return;
    }
    pendingFocus.current = focus;
    setStep(next);
  }

  /** Focuses the first invalid field, switching back to Personal details if that is where it is. */
  function revealFirstError(fields: string[]) {
    const target = fields.find(isPersonalField) ?? fields.find(isFormField);
    if (!target) return;
    goToStep(isPersonalField(target) ? 0 : 1, () => {
      if (target === "photo") photoInputRef.current?.focus();
      else if (isFormField(target)) form.setFocus(target);
    });
  }

  async function goToAccount() {
    const valid = await form.trigger(PERSONAL_FIELDS);
    const photoOk = photo !== null && photoError === null;
    if (!photo) setPhotoError(authMessage("PHOTO_REQUIRED").en);
    if (!valid || !photoOk) {
      setStatus({
        tone: "error",
        text: authMessage(valid && !photo ? "PHOTO_REQUIRED" : "CHECK_FIELDS"),
      });
      const invalid: string[] = PERSONAL_FIELDS.filter((name) => form.getFieldState(name).invalid);
      revealFirstError(photoOk ? invalid : [...invalid, "photo"]);
      return;
    }
    setStatus(null);
    goToStep(1, () => accountStepRef.current?.focus());
  }

  // Focusing the step container (not its first input) keeps fields untouched, so "onTouched"
  // validation does not flag an empty field the user never chose to visit.
  function backToPersonal() {
    setStatus(null);
    goToStep(0, () => personalStepRef.current?.focus());
  }

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    const check = checkPhotoFile(file);
    if (!check.ok) {
      setPhotoError(check.message);
      setPhoto(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }
    setPhotoError(null);
    setPhoto({ file, url: URL.createObjectURL(file) });
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoError(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
      photoInputRef.current.focus();
    }
  }

  async function uploadPhoto(result: RegisterResult, file: File): Promise<boolean> {
    try {
      // Signed in straight away (no e-mail confirmation): upload with the new session.
      if (result.signedIn) {
        const own = await uploadOwnPhoto(file);
        if (!own.ok) throw new Error(`uploadOwnPhoto: ${own.code}`);
        return true;
      }
      // Not signed in yet: one-time signed upload URL prepared by the server (service role).
      if (!result.photoUpload) return false;
      const { error } = await createClient()
        .storage.from("profile-photos")
        .uploadToSignedUrl(result.photoUpload.path, result.photoUpload.token, file, {
          contentType: file.type,
        });
      if (error) throw error;
      const attached = await attachRegistrationPhotoAction({
        userId: result.userId,
        path: result.photoUpload.path,
      });
      return attached.ok;
    } catch (error) {
      void reportClientError(error, { action: "registerPhotoUpload" }, "web", "warning");
      return false;
    }
  }

  // handleSubmit is created inside the event handler so the ref use stays out of render.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Enter (or "Next") on Personal details moves on instead of submitting.
    if (step === 0) {
      event.preventDefault();
      void goToAccount();
      return;
    }
    void form.handleSubmit(
      (values) => {
        if (photoError || !photo) {
          if (!photo) setPhotoError(authMessage("PHOTO_REQUIRED").en);
          setStatus({
            tone: "error",
            text: authMessage(photo ? "CHECK_FIELDS" : "PHOTO_REQUIRED"),
          });
          revealFirstError(["photo"]);
          return;
        }
        setStatus(null);
        startTransition(async () => {
          try {
            const meta = { name: photo.file.name, type: photo.file.type, size: photo.file.size };
            const result = await registerAction(values, meta);
            if (!result.ok) {
              const fieldErrors = Object.entries(result.fieldErrors ?? {});
              for (const [field, message] of fieldErrors) {
                if (field === "photo") setPhotoError(message);
                else if (isFormField(field)) form.setError(field, { message });
              }
              setStatus({ tone: "error", text: authMessage(result.code) });
              revealFirstError(fieldErrors.map(([field]) => field));
              return;
            }
            const photoSaved = await uploadPhoto(result.data, photo.file);
            setOutcome({ ...result.data, photoSaved });
          } catch (error) {
            void reportClientError(error, { action: "register" });
            setStatus({ tone: "error", text: authMessage("INTERNAL_ERROR") });
          }
        });
      },
      (errors) => {
        setStatus({ tone: "error", text: authMessage("CHECK_FIELDS") });
        revealFirstError(Object.keys(errors));
      },
    )(event);
  }

  if (outcome) return <RegisterSuccess outcome={outcome} />;

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title="Register as a Barangay Health Worker"
        fil="Magrehistro bilang Barangay Health Worker"
      >
        <p id="register-required-note" className="text-muted-foreground pt-1 text-sm">
          After you register, the BHW office administrator reviews your details. All fields are
          required unless marked optional.{" "}
          <span lang="fil">
            Kailangan ang lahat ng field maliban kung may nakasulat na &quot;optional&quot;.
          </span>
        </p>
      </AuthHeading>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-8"
        aria-describedby="register-required-note"
      >
        <StepIndicator step={step} />

        <div
          ref={personalStepRef}
          tabIndex={-1}
          aria-label={STEPS[0]}
          className={cn("flex flex-col gap-8 outline-none", step !== 0 && "hidden")}
        >
          <FieldSet>
            <FieldLegend>Personal details</FieldLegend>
            <FieldGroup className="gap-5">
              <TextField
                control={form.control}
                name="fullName"
                label="Full name"
                autoComplete="name"
                hint={{ en: "First name, middle initial, last name.", fil: "Buong pangalan." }}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  control={form.control}
                  name="bhwIdNumber"
                  label="BHW ID number"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  hint={{ en: "As printed on your BHW ID.", fil: "Ayon sa iyong BHW ID." }}
                />
                <TextField
                  control={form.control}
                  name="contactNumber"
                  label="Mobile number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="09171234567"
                  hint={{ en: "11 digits, starts with 09.", fil: "11 numero, nagsisimula sa 09." }}
                />
              </div>
              <TextField
                control={form.control}
                name="area"
                label="Purok / area"
                list={purokListId}
                autoComplete="off"
                hint={{
                  en: "Choose from the list or type your purok.",
                  fil: "Pumili o i-type ang iyong purok.",
                }}
              />
              <datalist id={purokListId}>
                {PUROK_SUGGESTIONS.map((purok) => (
                  <option key={purok} value={purok} />
                ))}
              </datalist>
              <TextField
                control={form.control}
                name="address"
                label="Home address"
                optional
                autoComplete="street-address"
                hint={{ en: "Stored encrypted.", fil: "Naka-encrypt itong itatago." }}
              />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Profile photo</FieldLegend>
            <Field data-invalid={photoError ? true : undefined}>
              <FieldLabel htmlFor="register-photo">Photo of your face</FieldLabel>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                  className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                  aria-hidden={photo ? undefined : true}
                >
                  {photo ? (
                    <Image
                      src={photo.url}
                      alt="Preview of your chosen profile photo"
                      width={96}
                      height={96}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageUp className="size-8" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input
                    ref={photoInputRef}
                    id="register-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    aria-invalid={photoError ? true : undefined}
                    aria-describedby={
                      photoError
                        ? "register-photo-hint register-photo-error"
                        : "register-photo-hint"
                    }
                    onChange={(event) => choosePhoto(event.target.files?.[0])}
                    className="h-11 py-2 md:text-base"
                  />
                  {photo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 self-start"
                      onClick={removePhoto}
                    >
                      <Trash2 aria-hidden="true" />
                      Remove photo
                    </Button>
                  ) : null}
                </div>
              </div>
              <FieldDescription id="register-photo-hint">
                Required. A clear photo of your face; JPG, PNG or WebP, up to 5 MB. The
                administrator uses it to confirm who you are.{" "}
                <span lang="fil">
                  Kailangan. Malinaw na larawan ng iyong mukha; JPG, PNG o WebP, hanggang 5 MB.
                </span>
              </FieldDescription>
              <FieldError id="register-photo-error">{photoError}</FieldError>
            </Field>
          </FieldSet>
        </div>

        <div
          ref={accountStepRef}
          tabIndex={-1}
          aria-label={STEPS[1]}
          className={cn("flex flex-col gap-8 outline-none", step !== 1 && "hidden")}
        >
          <FieldSet>
            <FieldLegend>Account</FieldLegend>
            <FieldGroup className="gap-5">
              <TextField
                control={form.control}
                name="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                hint={{
                  en: "You will log in with this email. Use one you can open.",
                  fil: "Ito ang gagamitin mo sa pag-login. Gumamit ng email na nabubuksan mo.",
                }}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="register-password">Password</FieldLabel>
                      <PasswordInput
                        {...field}
                        id="register-password"
                        autoComplete="new-password"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.error
                            ? "register-password-hint register-password-error"
                            : "register-password-hint"
                        }
                      />
                      <FieldDescription id="register-password-hint">
                        At least 8 characters. <span lang="fil">Hindi bababa sa 8 character.</span>
                      </FieldDescription>
                      <FieldError id="register-password-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name="confirmPassword"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="register-confirm-password">Confirm password</FieldLabel>
                      <PasswordInput
                        {...field}
                        id="register-confirm-password"
                        autoComplete="new-password"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.error ? "register-confirm-password-error" : undefined
                        }
                      />
                      <FieldError
                        id="register-confirm-password-error"
                        errors={[fieldState.error]}
                      />
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Data privacy consent</FieldLegend>
            <Controller
              name="consent"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  orientation="horizontal"
                  data-invalid={fieldState.invalid}
                  className="items-start"
                >
                  <Checkbox
                    id="register-consent"
                    ref={field.ref}
                    name={field.name}
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? "register-consent-error" : undefined}
                    className="mt-1 size-5"
                  />
                  <FieldContent>
                    <FieldLabel
                      htmlFor="register-consent"
                      className="block leading-relaxed font-normal"
                    >
                      {CONSENT_TEXT.en.before}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-brand font-medium underline underline-offset-4"
                      >
                        {CONSENT_TEXT.en.link}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </Link>
                      {CONSENT_TEXT.en.after}
                    </FieldLabel>
                    <p lang="fil" className="text-muted-foreground text-sm leading-relaxed">
                      {CONSENT_TEXT.fil.before}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="underline underline-offset-4"
                      >
                        {CONSENT_TEXT.fil.link}
                        <span className="sr-only"> (bubukas sa bagong tab)</span>
                      </Link>
                      {CONSENT_TEXT.fil.after}
                    </p>
                    <FieldError id="register-consent-error" errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />
          </FieldSet>
        </div>

        <FormStatus status={status} />

        <div className="flex flex-col gap-4">
          {step === 0 ? (
            <Button type="submit" className="h-11 w-full text-base">
              Next: Account
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base"
                // Keep focus where it is on press: a blur here could show a validation message,
                // shift the layout and make the click miss this button.
                onMouseDown={(event) => event.preventDefault()}
                onClick={backToPersonal}
                disabled={pending}
              >
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
              <Button type="submit" className="h-11 flex-1 text-base" disabled={pending}>
                <UserPlus aria-hidden="true" />
                {pending ? "Submitting registration…" : "Submit registration"}
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            Already registered?{" "}
            <Link
              href="/login"
              className="text-brand inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
