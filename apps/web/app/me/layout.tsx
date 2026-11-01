import { LogOutIcon, QrCodeIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My Attendance" };

/** Employee web area: a simple header (no admin sidebar) and a centered column. */
export default function MeLayout({ children }: LayoutProps<"/me">) {
  // The session (cookies) is read inside Suspense so Cache Components can prerender the shell.
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl space-y-4 p-6" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <MeShell>{children}</MeShell>
    </Suspense>
  );
}

async function MeShell({ children }: { children: ReactNode }) {
  const profile = await requireProfile(["employee"]);

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background-subtle">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <QrCodeIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">BHW QR Attendance</p>
            <p className="truncate text-xs text-muted-foreground">{profile.full_name}</p>
          </div>
          <ThemeToggle />
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              <LogOutIcon aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
