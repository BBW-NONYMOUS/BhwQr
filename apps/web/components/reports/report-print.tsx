import { cn } from "@/lib/utils";

// Print-only pieces of the attendance reports: page setup, barangay header, full table (the
// on-screen DataTable is paginated, so print uses this unpaginated copy of the same rows) and
// the "Prepared by" / "Noted by" signature block. Black on white regardless of theme.

function printCss(orientation: "portrait" | "landscape") {
  return `
@page { size: A4 ${orientation}; margin: 12mm; }
@media print {
  html, body { background: white !important; color: black !important; }
  [data-slot="sidebar"], [data-slot="sidebar-gap"], [data-slot="sidebar-container"],
  [data-slot="sidebar-rail"], [data-slot="sidebar-trigger"] { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-inset"] {
    display: block !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important;
    background: white !important; box-shadow: none !important; border: 0 !important;
  }
  #main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .report-print, .report-print * { color: black !important; border-color: black !important; background: transparent !important; }
  .report-print-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  .report-print-table th, .report-print-table td { border: 0.2mm solid black; padding: 0.6mm 1.2mm; white-space: nowrap; }
  .report-print-table tfoot td { white-space: normal; }
  .report-print-table thead { display: table-header-group; }
  .report-print-table tr { break-inside: avoid; }
  .report-print-table tfoot td { font-weight: 700; border-top-width: 0.4mm; }
}
`;
}

/** Page setup for report printing. Daily is portrait; weekly and monthly are landscape (more columns). */
export function ReportPrintStyle({ orientation }: { orientation: "portrait" | "landscape" }) {
  return <style>{printCss(orientation)}</style>;
}

/** Barangay header: shown on screen as the report title block and printed at the top of page 1. */
export function ReportHeader({
  officeName,
  officeAddress,
  title,
  period,
  filters,
  generatedAt,
}: {
  officeName: string;
  officeAddress: string;
  title: string;
  period: string;
  filters: string;
  generatedAt: string;
}) {
  return (
    <header className="report-print space-y-1 rounded-xl border bg-card p-4 text-center print:rounded-none print:border-0 print:p-0 print:pb-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Republic of the Philippines</p>
      <p className="text-base font-semibold">{officeName}</p>
      {officeAddress ? <p className="text-sm text-muted-foreground">{officeAddress}</p> : null}
      <h2 className="pt-2 text-lg font-bold tracking-wide uppercase">{title}</h2>
      <p className="text-sm">{period}</p>
      <p className="text-xs text-muted-foreground">
        {filters} · Generated {generatedAt} (Manila time)
      </p>
    </header>
  );
}

export interface PrintColumn<T> {
  header: string;
  value: (row: T) => string | number | null;
  align?: "left" | "right" | "center";
}

/** Unpaginated table of every displayed row plus a totals row, visible only in print. */
export function ReportPrintTable<T>({
  caption,
  columns,
  rows,
  totals,
}: {
  caption: string;
  columns: PrintColumn<T>[];
  rows: T[];
  /** One cell per column; null leaves the cell empty. */
  totals: (string | number | null)[];
}) {
  const alignClass = (a: PrintColumn<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
  return (
    <table className="report-print report-print-table hidden tabular-nums print:table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.header} scope="col" className={cn("font-semibold", alignClass(c.align))}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.header} className={alignClass(c.align)}>
                {c.value(row) ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          {columns.map((c, i) => (
            <td key={c.header} className={alignClass(c.align)}>
              {totals[i] ?? ""}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

/** On-screen totals under the DataTable; values come from counting the displayed rows. */
export function TotalsStrip({ label, items }: { label: string; items: { label: string; value: string | number }[] }) {
  return (
    <section aria-label={label} className="rounded-xl border bg-muted/40 p-4 print:hidden">
      <p className="pb-2 text-sm font-medium">{label}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "Prepared by" and "Noted by" signature lines, printed after the table. */
export function ReportSignatures({ preparedBy }: { preparedBy: string }) {
  return (
    <div className="report-print hidden grid-cols-2 gap-16 pt-12 text-sm break-inside-avoid print:grid">
      <div>
        <p>Prepared by:</p>
        <div className="mt-10 border-b border-current" aria-hidden />
        <p className="pt-1 text-center font-semibold uppercase">{preparedBy}</p>
        <p className="text-center text-xs">Signature over printed name</p>
      </div>
      <div>
        <p>Noted by:</p>
        <div className="mt-10 border-b border-current" aria-hidden />
        <p className="pt-1 text-center">&nbsp;</p>
        <p className="text-center text-xs">Signature over printed name</p>
      </div>
    </div>
  );
}
