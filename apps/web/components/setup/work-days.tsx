import { cn } from "@/lib/utils";

import { WEEKDAYS } from "./schedule";

/** Seven Mon..Sun chips; work days are filled, rest days muted. Screen readers get the full list. */
export function WorkDayChips({ days }: { days: readonly number[] }) {
  const label = WEEKDAYS.filter((d) => days.includes(d.iso))
    .map((d) => d.long)
    .join(", ");
  return (
    <span className="inline-flex gap-1" role="img" aria-label={label ? `Work days: ${label}` : "No work days"}>
      {WEEKDAYS.map((d) => {
        const on = days.includes(d.iso);
        return (
          <span
            key={d.iso}
            aria-hidden
            className={cn(
              "inline-flex h-6 w-9 items-center justify-center rounded-full text-xs font-medium",
              on ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {d.short}
          </span>
        );
      })}
    </span>
  );
}
