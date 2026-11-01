import { CalendarCheck, QrCode, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { BackgroundBeams } from "./background-beams";
import { BrandMark } from "./brand-mark";

const POINTS = [
  {
    icon: QrCode,
    en: "Time in and out with one QR scan",
    fil: "Isang scan lang sa QR para sa time in at time out",
  },
  {
    icon: CalendarCheck,
    en: "Your Daily Time Record, ready every month",
    fil: "Handa ang iyong DTR bawat buwan",
  },
  {
    icon: ShieldCheck,
    en: "Your personal data is protected (RA 10173)",
    fil: "Protektado ang iyong personal na datos",
  },
] as const;

/**
 * Two-column auth layout (shadcn login block style): teal brand panel with the Aceternity
 * beams on the left (large screens only), the form on the right.
 */
export function AuthShell({
  children,
  width = "narrow",
}: {
  children: ReactNode;
  /** "narrow" for login-sized forms, "wide" for the registration form. */
  width?: "narrow" | "wide";
}) {
  return (
    <div
      className={cn(
        "grid min-h-svh flex-1",
        width === "narrow" ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
      )}
    >
      <aside className="bg-brand text-brand-foreground relative hidden overflow-hidden lg:block">
        <div className="sticky top-0 flex h-svh flex-col justify-between p-10">
          <BackgroundBeams />
          <BrandMark inverted className="relative z-10 self-start" />
          <div className="relative z-10 flex max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-3xl font-semibold tracking-tight text-balance">
                Barangay Kalawag II Health Workers Office
              </p>
              <p className="text-brand-foreground/80">
                Attendance made simple for our Barangay Health Workers.
              </p>
            </div>
            <ul className="flex flex-col gap-4">
              {POINTS.map(({ icon: Icon, en, fil }) => (
                <li key={en} className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="font-medium">{en}</span>
                    <span lang="fil" className="text-brand-foreground/80 text-sm">
                      {fil}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-brand-foreground/80 relative z-10 text-sm">Isulan, Sultan Kudarat</p>
        </div>
      </aside>

      <div className="bg-background flex flex-col">
        <header className="flex items-center justify-between gap-4 p-4 md:px-8">
          <BrandMark className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main
          id="main"
          className={cn(
            "mx-auto flex w-full flex-1 flex-col justify-center px-4 pt-2 pb-12 md:px-8",
            width === "narrow" ? "max-w-sm" : "max-w-2xl",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
