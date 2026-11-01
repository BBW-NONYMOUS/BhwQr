import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/auth/brand-mark";
import { PRIVACY_EN, PRIVACY_FIL, PRIVACY_TITLE } from "@/components/auth/privacy-notice";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Data Privacy Notice",
  description:
    "How the BHW QR Attendance System of Barangay Kalawag II collects, uses and protects personal data (RA 10173).",
};

function Notice({ sections, lang }: { sections: typeof PRIVACY_EN; lang: "en" | "fil" }) {
  return (
    <article lang={lang} className="flex flex-col gap-8">
      <p className="text-base font-semibold">{PRIVACY_TITLE}</p>
      {sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`${lang}-${section.id}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`${lang}-${section.id}`} className="text-lg font-semibold tracking-tight">
            {section.heading}
          </h2>
          <div className="text-foreground/90 text-base leading-relaxed [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
            {section.body}
          </div>
        </section>
      ))}
    </article>
  );
}

export default function PrivacyPage() {
  return (
    <div className="bg-background-subtle flex flex-1 flex-col">
      <header className="bg-background flex items-center justify-between gap-4 border-b p-4 md:px-8">
        <BrandMark />
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-12"
      >
        <Button asChild variant="ghost" className="h-11 self-start px-2">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Back to home
          </Link>
        </Button>

        <div className="flex items-start gap-4">
          <span className="bg-brand text-brand-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              Data Privacy Notice
            </h1>
            <p lang="fil" className="text-muted-foreground">
              Abiso sa Privacy ng Datos · Republic Act No. 10173 (Data Privacy Act of 2012)
            </p>
          </div>
        </div>

        <Tabs defaultValue="en" className="gap-6">
          <TabsList
            aria-label="Language / Wika"
            className="w-full group-data-horizontal/tabs:h-11 sm:w-fit"
          >
            <TabsTrigger value="en" className="min-w-32 px-4">
              English
            </TabsTrigger>
            <TabsTrigger value="fil" className="min-w-32 px-4">
              Filipino
            </TabsTrigger>
          </TabsList>
          <div className="bg-card text-card-foreground rounded-xl border p-5 shadow-xs md:p-8">
            <TabsContent value="en">
              <Notice sections={PRIVACY_EN} lang="en" />
            </TabsContent>
            <TabsContent value="fil">
              <Notice sections={PRIVACY_FIL} lang="fil" />
            </TabsContent>
          </div>
        </Tabs>

        <p className="text-muted-foreground text-sm">
          Questions about your data? Visit the Barangay Hall, Kalawag II, Isulan, Sultan Kudarat.{" "}
          <span lang="fil">May tanong tungkol sa iyong datos? Pumunta sa Barangay Hall.</span>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11">
            <Link href="/register">Register as a BHW</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
