import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { PH_REGULAR_HOLIDAYS, holidayYearOptions, missingHolidays, parseYear } from "@/components/setup/holidays";
import { HolidaysManager } from "@/components/setup/holidays-manager";
import { ErrorState, TableSkeleton } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { addHoliday, addPresetHolidays, deleteHoliday, recomputeFromHolidays } from "./actions";

export const metadata: Metadata = { title: "Holidays" };

export default function HolidaysPage({ searchParams }: PageProps<"/admin/holidays">) {
  return (
    <>
      <PageHeader
        title="Holidays"
        description="Non-working holidays. No absences are marked on these dates and the DTR shows the holiday name."
      />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <HolidaysData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function HolidaysData({ searchParams }: { searchParams: PageProps<"/admin/holidays">["searchParams"] }) {
  await requireProfile(["admin"]);
  const sp = await searchParams;
  const today = manilaToday();
  const currentYear = Number(today.slice(0, 4));
  const year = parseYear(sp.year, currentYear);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("date, name")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");

  if (error) {
    return <ErrorState message="Holidays could not be loaded. Please refresh the page." />;
  }

  const preset = PH_REGULAR_HOLIDAYS[year];
  return (
    <HolidaysManager
      key={year}
      year={year}
      years={holidayYearOptions(currentYear, [year])}
      today={today}
      holidays={data}
      presetMissing={
        preset
          ? missingHolidays(
              data.map((h) => h.date),
              preset,
            )
          : null
      }
      actions={{
        add: addHoliday,
        remove: deleteHoliday,
        addPreset: addPresetHolidays,
        recompute: recomputeFromHolidays,
      }}
    />
  );
}
