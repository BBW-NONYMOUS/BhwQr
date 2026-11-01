import { AlertTriangleIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  type DtrDocument,
  type DtrDocumentRow,
  spanningRemark,
  timeCells,
  totalsMatchRows,
  undertimeCells,
} from "./dtr-utils";

// Print geometry for CSC Form No. 48: two identical copies side by side on A4 landscape, the
// same arrangement as supabase/functions/generate-dtr-pdf/render.ts. These rules are unlayered,
// so inside @media print they win over the Tailwind (layered) screen classes. Print is black on
// white regardless of the theme; the portal chrome (sidebar, header, page header) is hidden.
const DTR_PRINT_CSS = `
@page { size: A4 landscape; margin: 8mm; }
@media print {
  html, body { background: white !important; color: black !important; }
  [data-slot="sidebar"], [data-slot="sidebar-gap"], [data-slot="sidebar-container"],
  [data-slot="sidebar-rail"], [data-slot="sidebar-trigger"] { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-inset"] {
    display: block !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important;
    background: white !important; box-shadow: none !important; border: 0 !important;
  }
  #main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .dtr-sheet {
    display: flex; gap: 12mm; width: 100%; height: 192mm; overflow: hidden; margin: 0 !important;
    color: black; background: white;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .dtr-sheet[data-break="true"] { break-after: page; page-break-after: always; }
  .dtr-sheet * { color: black !important; border-color: black !important; background: transparent !important; }
  /* Height budget (194 mm printable): header ~34 mm, table ~124 mm, footer ~26 mm. */
  .dtr-copy { flex: 1 1 0; min-width: 0; gap: 0.3mm; font-size: 7pt; line-height: 1.2; }
  .dtr-copy .dtr-form-no { font-size: 7pt; }
  .dtr-copy .dtr-title { font-size: 12pt; letter-spacing: 0.02em; padding-top: 1mm; }
  .dtr-copy .dtr-small { font-size: 7pt; }
  .dtr-copy .dtr-name { font-size: 10pt; padding-top: 1.5mm; }
  .dtr-copy .dtr-meta { font-size: 8pt; padding-top: 1mm; }
  .dtr-copy .dtr-hours { font-size: 7pt; }
  .dtr-table { margin-top: 1mm; }
  .dtr-table th, .dtr-table td { height: 3.6mm; padding: 0 0.5mm; border-width: 0.2mm; font-size: 7pt; line-height: 1; }
  .dtr-table thead th { height: 3.8mm; font-size: 6.5pt; }
  .dtr-table .dtr-remark { font-size: 6.5pt; }
  .dtr-table tfoot td { font-size: 7.5pt; border-width: 0.3mm; }
  .dtr-copy .dtr-cert { font-size: 6.8pt; line-height: 1.25; padding-top: 1mm; }
  .dtr-copy .dtr-sign { padding-top: 4mm; }
  .dtr-copy .dtr-sign-label { font-size: 6.5pt; padding-top: 0.3mm; }
}
`;

/** Print stylesheet for the DTR page. Render once per page. */
export function DtrPrintStyle() {
  return <style>{DTR_PRINT_CSS}</style>;
}

const cell = "border border-foreground/70 px-1 text-center";

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="dtr-sign mx-auto w-1/2 pt-6 text-center">
      <div className="border-b border-foreground/70" aria-hidden />
      <p className="dtr-sign-label pt-0.5 text-[11px]">{label}</p>
    </div>
  );
}

function DtrRowView({ row, showStatus }: { row: DtrDocumentRow; showStatus: boolean }) {
  const remark = spanningRemark(row);
  const [utH, utM] = undertimeCells(row);
  return (
    <tr className={cn(!row.work_date && "text-muted-foreground", remark && "bg-muted/40")}>
      <td className={cell}>{row.day}</td>
      {remark ? (
        <td colSpan={4} className={cn(cell, "dtr-remark text-[11px] font-bold tracking-wide")}>
          {remark}
        </td>
      ) : (
        timeCells(row).map((t, i) => (
          <td key={i} className={cell}>
            {t}
          </td>
        ))
      )}
      <td className={cell}>{utH}</td>
      <td className={cell}>{utM}</td>
      {showStatus ? (
        <td className="border border-foreground/70 px-2 py-px text-left print:hidden">
          {row.status ? (
            <StatusBadge status={row.status} className="h-4.5 px-1.5 py-0 text-[11px]" />
          ) : row.work_date && row.remark && !remark ? (
            <span className="text-xs text-muted-foreground">{row.remark}</span>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}

/**
 * One copy of Civil Service Form No. 48 for a DtrDocument. Pure presentational: prints the 31
 * rows exactly in order and the document's own TOTAL line (data dictionary 7.2).
 * `showStatus` adds an on-screen status column (hidden in print).
 */
export function CscForm48Copy({ doc, showStatus = false }: { doc: DtrDocument; showStatus?: boolean }) {
  const saturdays = doc.office_hours.saturdays || "—";
  return (
    <div className="dtr-copy flex flex-col gap-1 text-xs text-card-foreground">
      <p className="dtr-form-no text-[11px] font-bold">Civil Service Form No. 48</p>
      <p className="dtr-title pt-2 text-center text-lg font-bold tracking-wide">DAILY TIME RECORD</p>
      <p className="dtr-small text-center text-[11px]" aria-hidden>
        -----o0o-----
      </p>
      <div className="dtr-name mx-auto w-4/5 pt-3 text-center text-sm">
        <p className="border-b border-foreground/70 pb-0.5 font-bold uppercase">{doc.employee.full_name}</p>
        <p className="dtr-small text-[11px] font-normal">(Name)</p>
      </div>
      <div className="dtr-meta flex flex-wrap justify-between gap-x-4 pt-2">
        <p>
          For the month of <span className="font-semibold">{doc.period.label}</span>
        </p>
        <p>BHW ID: {doc.employee.bhw_id_number ?? ""}</p>
      </div>
      <div className="dtr-hours grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-3 text-[11px]">
        <p>Official hours for arrival and departure</p>
        <div>
          <p>Regular days: {doc.office_hours.regular_days}</p>
          <p>Saturdays: {saturdays}</p>
        </div>
      </div>

      <table className="dtr-table mt-1 w-full border-collapse tabular-nums">
        <caption className="sr-only">
          Daily time record of {doc.employee.full_name} for {doc.period.label}
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={cn(cell, "w-[9%] font-bold")}>
              Day
            </th>
            <th scope="colgroup" colSpan={2} className={cn(cell, "font-bold")}>
              A.M.
            </th>
            <th scope="colgroup" colSpan={2} className={cn(cell, "font-bold")}>
              P.M.
            </th>
            <th scope="colgroup" colSpan={2} className={cn(cell, "font-bold")}>
              Undertime
            </th>
            {showStatus ? (
              <th scope="col" rowSpan={2} className={cn(cell, "w-28 font-medium print:hidden")}>
                Status
              </th>
            ) : null}
          </tr>
          <tr>
            {["Arrival", "Departure", "Arrival", "Departure", "Hours", "Minutes"].map((label, i) => (
              <th key={i} scope="col" className={cn(cell, "font-normal")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((row) => (
            <DtrRowView key={row.day} row={row} showStatus={showStatus} />
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={5} className={cn(cell, "pr-3 text-right")}>
              TOTAL
            </td>
            <td className={cell}>{doc.totals.undertime_hours}</td>
            <td className={cell}>{doc.totals.undertime_minutes}</td>
            {showStatus ? <td className={cn(cell, "print:hidden")} /> : null}
          </tr>
        </tfoot>
      </table>

      <p className="dtr-cert pt-2 text-[11px] leading-snug">{doc.certification}</p>
      <SignatureLine label="(Signature)" />
      <p className="dtr-cert pt-2 text-[11px]">{doc.verified_label}</p>
      <SignatureLine label="In Charge" />
    </div>
  );
}

/** Print-only A4 landscape sheet: two identical copies side by side. */
export function CscForm48Sheet({ doc, pageBreak = false }: { doc: DtrDocument; pageBreak?: boolean }) {
  return (
    <div className="dtr-sheet hidden" data-break={pageBreak ? "true" : "false"} aria-hidden>
      <CscForm48Copy doc={doc} />
      <CscForm48Copy doc={doc} />
    </div>
  );
}

/**
 * CSC Form No. 48 for one employee: on screen a single copy inside a Card with a status column;
 * in print the two-copy sheet. `pageBreak` starts the next employee on a new page (batch).
 */
export function CscForm48({ doc, pageBreak = false }: { doc: DtrDocument; pageBreak?: boolean }) {
  const consistent = totalsMatchRows(doc);
  return (
    <>
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{doc.employee.full_name}</CardTitle>
          <CardDescription>
            {doc.employee.bhw_id_number ?? "No BHW ID"} · {doc.period.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consistent ? null : (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>TOTAL does not match the daily rows</AlertTitle>
              <AlertDescription>
                The undertime TOTAL from the server differs from the sum of the 31 rows. Regenerate the DTR
                before printing and report this in Error Logs if it persists.
              </AlertDescription>
            </Alert>
          )}
          <div className="overflow-x-auto">
            <div className="mx-auto max-w-3xl min-w-[560px]">
              <CscForm48Copy doc={doc} showStatus />
            </div>
          </div>
        </CardContent>
      </Card>
      <CscForm48Sheet doc={doc} pageBreak={pageBreak} />
    </>
  );
}
