"use client";

import { FilterXIcon, LoaderCircleIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

export interface FilterSelect {
  /** URL search param name. */
  param: string;
  label: string;
  allLabel: string;
  value: string | null;
  options: { value: string; label: string }[];
}

/**
 * Filters kept in the URL so the Server Component re-queries with them (and links can be shared).
 * Changing a Select or a date navigates immediately.
 */
export function LogFilterBar({ selects, from, to }: { selects: FilterSelect[]; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === ALL) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const hasFilters = selects.some((s) => s.value !== null) || searchParams.has("from") || searchParams.has("to");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3" role="search" aria-label="Filters">
      {selects.map((s) => {
        const id = `filter-${s.param}`;
        return (
          <div key={s.param} className="grid gap-1.5">
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              {s.label}
            </Label>
            <Select value={s.value ?? ALL} onValueChange={(v) => update({ [s.param]: v })}>
              <SelectTrigger id={id} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{s.allLabel}</SelectItem>
                {s.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <div className="grid gap-1.5">
        <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="filter-from"
          type="date"
          className="w-40"
          defaultValue={from}
          max={to}
          onChange={(e) => (e.target.value ? update({ from: e.target.value }) : undefined)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="filter-to"
          type="date"
          className="w-40"
          defaultValue={to}
          min={from}
          onChange={(e) => (e.target.value ? update({ to: e.target.value }) : undefined)}
        />
      </div>
      <div className="flex items-center gap-2 pb-0.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasFilters || pending}
          onClick={() => update(Object.fromEntries([...selects.map((s) => [s.param, null]), ["from", null], ["to", null]]))}
        >
          <FilterXIcon data-icon="inline-start" aria-hidden />
          Reset
        </Button>
        {pending ? (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground" role="status">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Loading…
          </span>
        ) : null}
      </div>
    </div>
  );
}
