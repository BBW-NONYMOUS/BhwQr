"use client";

import { ImageOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { RegisterResult } from "./schemas";

const VERIFY_STEP = {
  en: "Open the verification link we sent to your email.",
  fil: "Buksan ang verification link na ipinadala namin sa iyong email.",
} as const;

const APPROVAL_STEPS = [
  {
    en: "The BHW office administrator reviews your registration and assigns your schedule.",
    fil: "Susuriin ng administrator ang iyong rehistro at itatakda ang iyong schedule.",
  },
  {
    en: "Once approved, install the BHW Attendance mobile app and log in with this email.",
    fil: "Kapag naaprubahan, i-install ang BHW Attendance mobile app at mag-login gamit ang email na ito.",
  },
] as const;

/**
 * Shown after a successful registration (FR-04). When the project requires e-mail confirmation
 * Supabase returns no session (signedIn false): verify first, then wait for approval. Without it
 * the account is signed in straight away and only the admin approval remains.
 */
export function RegisterSuccess({
  outcome,
}: {
  outcome: RegisterResult & { photoSaved: boolean };
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the result so keyboard and screen-reader users hear it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const photoMissing = outcome.photo !== "none" && !outcome.photoSaved;
  const mustVerify = !outcome.signedIn;
  const steps = mustVerify ? [VERIFY_STEP, ...APPROVAL_STEPS] : APPROVAL_STEPS;

  return (
    <section
      aria-labelledby="register-success-title"
      className="flex flex-col gap-6"
      aria-live="polite"
    >
      <span className="bg-brand text-brand-foreground flex size-12 items-center justify-center rounded-xl">
        <MailCheck className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h1
          id="register-success-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-balance outline-none"
        >
          {mustVerify
            ? "Check your email to verify, then wait for admin approval"
            : "Registration received, waiting for admin approval"}
        </h1>
        <p lang="fil" className="text-muted-foreground">
          {mustVerify
            ? "Tingnan ang iyong email para ma-verify, saka hintayin ang pag-apruba ng admin."
            : "Natanggap ang iyong rehistro. Hintayin ang pag-apruba ng admin."}
        </p>
        {mustVerify ? (
          <p className="text-sm">
            We sent the link to <strong className="break-all">{outcome.email}</strong>.{" "}
            <span lang="fil" className="text-muted-foreground">
              Ipinadala namin ang link sa email na ito.
            </span>
          </p>
        ) : (
          <p className="text-sm">
            You will log in with <strong className="break-all">{outcome.email}</strong>.{" "}
            <span lang="fil" className="text-muted-foreground">
              Ito ang email na gagamitin mo sa pag-login.
            </span>
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-4">
        {steps.map((step, index) => (
          <li key={step.en} className="flex gap-3">
            <span
              className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="flex flex-col">
              <span>{step.en}</span>
              <span lang="fil" className="text-muted-foreground text-sm">
                {step.fil}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {photoMissing ? (
        <Alert>
          <ImageOff aria-hidden="true" />
          <AlertTitle>Photo not saved yet</AlertTitle>
          <AlertDescription>
            <p>
              Your registration was received, but the photo could not be uploaded now. You can add
              it later.
            </p>
            <p lang="fil">
              Natanggap ang iyong rehistro, pero hindi pa na-upload ang larawan. Maaari mo itong
              idagdag mamaya.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {mustVerify ? (
        <p className="text-muted-foreground text-sm">
          No email after a few minutes? Check your spam folder, or log in and choose &quot;Resend
          verification email&quot;.{" "}
          <span lang="fil">
            Walang dumating na email? Tingnan ang spam folder, o mag-login at piliin ang
            &quot;Resend verification email&quot;.
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {outcome.signedIn ? (
          <Button asChild className="h-11">
            <Link href="/pending">See my registration status</Link>
          </Button>
        ) : (
          <Button asChild className="h-11">
            <Link href="/login">Go to log in</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}
