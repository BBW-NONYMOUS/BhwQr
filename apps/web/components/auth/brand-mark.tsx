import { QrCode } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** App logo + name. `inverted` is for the teal brand panel. */
export function BrandMark({
  inverted = false,
  className,
}: {
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-3 rounded-md font-semibold outline-none focus-visible:ring-3",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          inverted ? "bg-brand-foreground text-brand" : "bg-brand text-brand-foreground",
        )}
      >
        <QrCode className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span>BHW QR Attendance</span>
        <span
          className={cn(
            "text-xs font-normal",
            inverted ? "text-brand-foreground/80" : "text-muted-foreground",
          )}
        >
          Barangay Kalawag II
        </span>
      </span>
    </Link>
  );
}
