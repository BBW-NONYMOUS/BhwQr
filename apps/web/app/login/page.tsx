import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { LoginForm } from "@/components/login-form";
import { isLoginErrorCode, safeNext } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to the BHW QR Attendance System of Barangay Kalawag II.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <AuthHeading title="Log in to your account" fil="Mag-login sa iyong account" />
        <Suspense fallback={<FormSkeleton />}>
          <LoginFormFromUrl searchParams={searchParams} />
        </Suspense>
        <div className="flex flex-col gap-2 border-t pt-6 text-sm">
          <p>
            New Barangay Health Worker?{" "}
            <Link
              href="/register"
              className="text-brand inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
            >
              Register here
            </Link>
            <span lang="fil" className="text-muted-foreground block">
              Bagong BHW? Magrehistro dito.
            </span>
          </p>
          <p className="text-muted-foreground">
            Read our{" "}
            <Link
              href="/privacy"
              className="hover:text-foreground inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Data Privacy Notice
            </Link>
            .
          </p>
        </div>
      </div>
    </AuthShell>
  );
}

/** Reads `?error=` and `?next=` (request data, so it streams in behind Suspense). */
async function LoginFormFromUrl({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const error = isLoginErrorCode(params.error) ? params.error : undefined;
  const next = safeNext(params.next, "") || undefined;
  return <LoginForm initialError={error} next={next} />;
}
