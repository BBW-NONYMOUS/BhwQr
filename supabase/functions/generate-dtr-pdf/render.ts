// Draws CSC Form No. 48 (Daily Time Record). Two copies side by side on an A4 landscape page,
// as the form is traditionally printed in duplicate. Layout follows the official form: header,
// name, month, office hours lines, 31-day table (Day | A.M. Arrival/Departure | P.M.
// Arrival/Departure | Undertime Hours/Minutes), TOTAL line, certification, signature lines.
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

export interface DtrRow {
  day: number;
  work_date: string | null;
  am_arrival: string | null;
  am_departure: string | null;
  pm_arrival: string | null;
  pm_departure: string | null;
  undertime_hours: number;
  undertime_minutes: number;
  remark: string | null;
}

export interface DtrDocument {
  employee: { id: string; full_name: string; bhw_id_number: string | null };
  period: { year: number; month: number; label: string };
  office: { name: string; address: string };
  office_hours: { regular_days: string; saturdays: string };
  rows: DtrRow[];
  totals: { undertime_hours: number; undertime_minutes: number };
  certification: string;
  verified_label: string;
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const BLACK = rgb(0, 0, 0);

/** "08:05:00" -> "8:05" (12-hour without AM/PM, as handwritten on the form). */
export function formatCell(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = Number(h) % 12 === 0 ? 12 : Number(h) % 12;
  return `${hour}:${m}`;
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color: BLACK });
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCopy(page: PDFPage, doc: DtrDocument, x0: number, font: PDFFont, bold: PDFFont) {
  const width = 380;
  const cx = x0 + width / 2;
  let y = 575;
  page.drawText("Civil Service Form No. 48", { x: x0, y, size: 7, font: bold });
  y -= 16;
  centered(page, "DAILY TIME RECORD", bold, 12, cx, y);
  y -= 10;
  centered(page, "-----o0o-----", font, 7, cx, y);
  y -= 18;
  centered(page, doc.employee.full_name.toUpperCase(), bold, 10, cx, y);
  page.drawLine({ start: { x: x0 + 40, y: y - 2 }, end: { x: x0 + width - 40, y: y - 2 }, thickness: 0.5 });
  y -= 10;
  centered(page, "(Name)", font, 7, cx, y);
  y -= 14;
  page.drawText(`For the month of  ${doc.period.label}`, { x: x0, y, size: 8, font });
  page.drawText(`BHW ID: ${doc.employee.bhw_id_number ?? ""}`, { x: x0 + 250, y, size: 8, font });
  y -= 12;
  page.drawText("Official hours for arrival and departure", { x: x0, y, size: 7, font });
  page.drawText(`Regular days: ${doc.office_hours.regular_days}`, { x: x0 + 170, y, size: 7, font });
  y -= 10;
  page.drawText(`Saturdays: ${doc.office_hours.saturdays || "—"}`, { x: x0 + 170, y, size: 7, font });
  y -= 8;

  // Table header
  const cols = [0, 34, 92, 150, 208, 266, 323, 380]; // Day, AM arr, AM dep, PM arr, PM dep, UT h, UT m
  const top = y;
  const headerH = 20;
  page.drawRectangle({ x: x0, y: top - headerH, width, height: headerH, borderWidth: 0.6, borderColor: BLACK });
  centered(page, "Day", bold, 7, x0 + 17, top - 12);
  centered(page, "A.M.", bold, 7, x0 + 92, top - 7);
  centered(page, "P.M.", bold, 7, x0 + 208, top - 7);
  centered(page, "Undertime", bold, 7, x0 + 323, top - 7);
  const sub = ["Arrival", "Departure", "Arrival", "Departure", "Hours", "Minutes"];
  sub.forEach((t, i) => centered(page, t, font, 6.5, x0 + (cols[i + 1]! + cols[i + 2]!) / 2, top - 17));
  page.drawLine({ start: { x: x0 + 34, y: top - 10 }, end: { x: x0 + width, y: top - 10 }, thickness: 0.4 });

  // 31 rows
  const rowH = 10.8;
  let ry = top - headerH;
  for (const r of doc.rows) {
    page.drawRectangle({ x: x0, y: ry - rowH, width, height: rowH, borderWidth: 0.4, borderColor: BLACK });
    centered(page, String(r.day), font, 7, x0 + 17, ry - 7.8);
    const remark = r.remark && !r.am_arrival && !r.pm_arrival ? r.remark : null;
    if (remark && r.work_date) {
      centered(page, remark.toUpperCase(), bold, 6.5, x0 + 150, ry - 7.8);
    } else {
      [r.am_arrival, r.am_departure, r.pm_arrival, r.pm_departure].forEach((t, i) =>
        centered(page, formatCell(t), font, 7, x0 + (cols[i + 1]! + cols[i + 2]!) / 2, ry - 7.8)
      );
    }
    if (r.work_date && (r.undertime_hours || r.undertime_minutes)) {
      centered(page, String(r.undertime_hours || ""), font, 7, x0 + (cols[5]! + cols[6]!) / 2, ry - 7.8);
      centered(page, String(r.undertime_minutes || ""), font, 7, x0 + (cols[6]! + cols[7]!) / 2, ry - 7.8);
    }
    for (const c of cols.slice(1, -1)) {
      page.drawLine({ start: { x: x0 + c, y: ry }, end: { x: x0 + c, y: ry - rowH }, thickness: 0.4 });
    }
    ry -= rowH;
  }
  // TOTAL line
  page.drawRectangle({ x: x0, y: ry - rowH, width, height: rowH, borderWidth: 0.6, borderColor: BLACK });
  page.drawText("TOTAL", { x: x0 + 200, y: ry - 7.8, size: 7.5, font: bold });
  centered(page, String(doc.totals.undertime_hours), bold, 7.5, x0 + (cols[5]! + cols[6]!) / 2, ry - 7.8);
  centered(page, String(doc.totals.undertime_minutes), bold, 7.5, x0 + (cols[6]! + cols[7]!) / 2, ry - 7.8);
  ry -= rowH + 8;

  for (const line of wrap(doc.certification, font, 6.8, width)) {
    page.drawText(line, { x: x0, y: ry, size: 6.8, font });
    ry -= 8;
  }
  ry -= 10;
  page.drawLine({ start: { x: x0 + 90, y: ry }, end: { x: x0 + width - 90, y: ry }, thickness: 0.5 });
  ry -= 8;
  centered(page, "(Signature)", font, 6.5, cx, ry);
  ry -= 10;
  page.drawText(doc.verified_label, { x: x0, y: ry, size: 6.8, font });
  ry -= 14;
  page.drawLine({ start: { x: x0 + 90, y: ry }, end: { x: x0 + width - 90, y: ry }, thickness: 0.5 });
  ry -= 8;
  centered(page, "In Charge", font, 6.5, cx, ry);
}

export async function renderDtrPdf(docs: DtrDocument[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(docs.length === 1 ? `DTR ${docs[0]!.employee.full_name} ${docs[0]!.period.label}` : "DTR batch");
  pdf.setCreator("BHW QR Attendance System");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const doc of docs) {
    const page = pdf.addPage(A4_LANDSCAPE);
    drawCopy(page, doc, 25, font, bold);
    drawCopy(page, doc, 436, font, bold);
  }
  return await pdf.save();
}
