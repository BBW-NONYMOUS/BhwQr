import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "./brand-mark";
import { SignOutButton } from "./sign-out-button";

/** Layout for /pending and /rejected: header, one centered card, privacy link and sign-out. */
export function StatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background-subtle flex flex-1 flex-col">
      <header className="bg-background flex items-center justify-between gap-4 border-b p-4 md:px-8">
        <BrandMark />
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:py-14"
      >
        <div className="bg-card text-card-foreground rounded-xl border p-6 shadow-xs md:p-8">
          {children}
        </div>
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Data Privacy Notice · Abiso sa Privacy ng Datos
          </Link>
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}

export function StatusSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your account status">
      <Skeleton className="size-12 rounded-xl" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** Heading block with an icon, English title and Filipino subtitle. */
export function StatusHeading({
  icon,
  title,
  fil,
  tone = "brand",
}: {
  icon: ReactNode;
  title: string;
  fil: string;
  tone?: "brand" | "destructive";
}) {
  return (
    <div className="flex flex-col gap-4">
      <span
        className={
          tone === "brand"
            ? "bg-brand text-brand-foreground flex size-12 items-center justify-center rounded-xl"
            : "bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-xl"
        }
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p lang="fil" className="text-muted-foreground">
          {fil}
        </p>
      </div>
    </div>
  );
}
