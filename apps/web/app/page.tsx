import { CalendarCheck, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: QrCode,
    title: "Scan to time in and out",
    en: "Scan the QR code at the BHW office kiosk with your phone. No fingerprints needed.",
    fil: "I-scan ang QR code sa kiosk ng BHW office gamit ang iyong telepono.",
  },
  {
    icon: CalendarCheck,
    title: "Daily Time Record, done for you",
    en: "Your DTR (CSC Form No. 48) is prepared from your scans every month, ready to print.",
    fil: "Awtomatikong nabubuo ang iyong DTR mula sa iyong mga scan bawat buwan.",
  },
  {
    icon: ShieldCheck,
    title: "Safe and private",
    en: "Your contact details are encrypted and only the administrator can see them (RA 10173).",
    fil: "Naka-encrypt ang iyong contact details at ang administrator lamang ang makakakita.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="bg-background-subtle flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 p-4 md:px-8">
        <span className="bg-brand text-brand-foreground flex size-9 items-center justify-center rounded-md">
          <QrCode className="size-5" aria-hidden="true" />
          <span className="sr-only">BHW QR Attendance</span>
        </span>
        <ThemeToggle />
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-14 px-4 pt-6 pb-16 md:px-8"
      >
        <section
          className="flex flex-col items-center gap-8 text-center"
          aria-labelledby="hero-title"
        >
          <span className="bg-brand text-brand-foreground flex size-16 items-center justify-center rounded-2xl shadow-sm">
            <QrCode className="size-8" aria-hidden="true" />
          </span>
          <div className="flex max-w-3xl flex-col gap-4">
            <h1
              id="hero-title"
              className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
            >
              BHW QR Attendance System – Barangay Kalawag II Health Workers Office
            </h1>
            <p className="text-muted-foreground text-lg text-pretty">
              Fast, fair and paperless attendance for our Barangay Health Workers.{" "}
              <span lang="fil">
                Mabilis at patas na pagtatala ng attendance para sa ating mga BHW.
              </span>
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="h-11 min-w-36 text-base">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 min-w-36 text-base">
              <Link href="/register">Register</Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            New BHW? Register first, then wait for the administrator&apos;s approval.{" "}
            <span lang="fil">Bagong BHW? Magrehistro muna, saka hintayin ang pag-apruba.</span>
          </p>
        </section>

        <section aria-label="Features" className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, en, fil }) => (
            <div
              key={title}
              className="bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-6 shadow-xs"
            >
              <span className="bg-brand/10 text-brand flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm">{en}</p>
              <p lang="fil" className="text-muted-foreground text-sm">
                {fil}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="text-muted-foreground flex flex-col items-center gap-1 border-t px-4 py-6 text-center text-sm">
        <Link
          href="/privacy"
          className="hover:text-foreground inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Data Privacy Notice
        </Link>
        <p>Barangay Hall, Kalawag II, Isulan, Sultan Kudarat</p>
      </footer>
    </div>
  );
}
