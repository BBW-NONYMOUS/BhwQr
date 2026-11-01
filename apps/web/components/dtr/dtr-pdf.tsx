// Client-side CSC Form No. 48 PDF. Same layout as supabase/functions/generate-dtr-pdf/render.ts
// (A4 landscape, two 380 pt copies at x = 25 and x = 436, same column widths, TOTAL line,
// certification and signature lines, Helvetica). Vertical spacing is slightly tighter (22 pt
// header, 11.2 pt rows) so the "In Charge" line stays on the page; render.ts draws it below the
// bottom edge. Loaded with a dynamic import from dtr-actions.tsx so @react-pdf/renderer never
// ships with the page itself.
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { type DtrDocument, type DtrDocumentRow, spanningRemark, timeCells, undertimeCells } from "./dtr-utils";

const COPY_WIDTH = 380;
// Day, AM arrival, AM departure, PM arrival, PM departure, UT hours, UT minutes (render.ts cols).
const COL_WIDTHS = [34, 58, 58, 58, 58, 57, 57] as const;
const ROW_H = 11.2;
const HEADER_H = 22;

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", color: "black", backgroundColor: "white" },
  copy: { position: "absolute", top: 14, width: COPY_WIDTH },
  formNo: { fontFamily: "Helvetica-Bold", fontSize: 7 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "center", marginTop: 4 },
  ornament: { fontSize: 7, textAlign: "center", marginTop: 1 },
  nameBox: { marginTop: 6, marginHorizontal: 40, borderBottomWidth: 0.5, borderColor: "black" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", textTransform: "uppercase" },
  small: { fontSize: 7, textAlign: "center", marginTop: 1 },
  metaRow: { flexDirection: "row", marginTop: 4, fontSize: 8 },
  hoursRow: { flexDirection: "row", marginTop: 3, fontSize: 7 },
  table: { marginTop: 3, borderWidth: 0.6, borderColor: "black" },
  headerRow: { flexDirection: "row", height: HEADER_H, borderBottomWidth: 0.4, borderColor: "black" },
  row: { flexDirection: "row", height: ROW_H, borderBottomWidth: 0.4, borderColor: "black" },
  cell: { justifyContent: "center", alignItems: "center", borderRightWidth: 0.4, borderColor: "black" },
  cellText: { fontSize: 7 },
  subText: { fontSize: 6.5 },
  bold7: { fontFamily: "Helvetica-Bold", fontSize: 7 },
  remark: { fontFamily: "Helvetica-Bold", fontSize: 6.5 },
  totalRow: { flexDirection: "row", height: ROW_H, borderTopWidth: 0.2, borderColor: "black" },
  totalText: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  cert: { fontSize: 6.8, lineHeight: 1.25, marginTop: 6 },
  signLine: { marginHorizontal: 90, borderBottomWidth: 0.5, borderColor: "black" },
  signLabel: { fontSize: 6.5, textAlign: "center", marginTop: 2 },
  verified: { fontSize: 6.8, marginTop: 4 },
});

function Cell({ width, text, last = false, bold = false }: { width: number; text: string; last?: boolean; bold?: boolean }) {
  return (
    <View style={[s.cell, { width }, last ? { borderRightWidth: 0 } : {}]}>
      <Text style={bold ? s.totalText : s.cellText}>{text}</Text>
    </View>
  );
}

function HeaderGroup({ label, sub, widths, last = false }: { label: string; sub: [string, string]; widths: [number, number]; last?: boolean }) {
  return (
    <View style={[{ width: widths[0] + widths[1] }, last ? {} : { borderRightWidth: 0.4, borderColor: "black" }]}>
      <View style={{ height: HEADER_H / 2, justifyContent: "center", alignItems: "center", borderBottomWidth: 0.4, borderColor: "black" }}>
        <Text style={s.bold7}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", height: HEADER_H / 2 }}>
        <View style={[s.cell, { width: widths[0] }]}>
          <Text style={s.subText}>{sub[0]}</Text>
        </View>
        <View style={[s.cell, { width: widths[1], borderRightWidth: 0 }]}>
          <Text style={s.subText}>{sub[1]}</Text>
        </View>
      </View>
    </View>
  );
}

function PdfRow({ row }: { row: DtrDocumentRow }) {
  const remark = spanningRemark(row);
  const [utH, utM] = undertimeCells(row);
  const times = timeCells(row);
  return (
    <View style={s.row}>
      <Cell width={COL_WIDTHS[0]} text={String(row.day)} />
      {remark ? (
        <View style={[s.cell, { width: COL_WIDTHS[1] * 4 }]}>
          <Text style={s.remark}>{remark}</Text>
        </View>
      ) : (
        times.map((t, i) => <Cell key={i} width={COL_WIDTHS[i + 1]!} text={t} />)
      )}
      <Cell width={COL_WIDTHS[5]} text={utH} />
      <Cell width={COL_WIDTHS[6]} text={utM} last />
    </View>
  );
}

function Copy({ doc, left }: { doc: DtrDocument; left: number }) {
  return (
    <View style={[s.copy, { left }]}>
      <Text style={s.formNo}>Civil Service Form No. 48</Text>
      <Text style={s.title}>DAILY TIME RECORD</Text>
      <Text style={s.ornament}>-----o0o-----</Text>
      <View style={s.nameBox}>
        <Text style={s.name}>{doc.employee.full_name}</Text>
      </View>
      <Text style={s.small}>(Name)</Text>
      <View style={s.metaRow}>
        <Text style={{ width: 250 }}>For the month of {doc.period.label}</Text>
        <Text>BHW ID: {doc.employee.bhw_id_number ?? ""}</Text>
      </View>
      <View style={s.hoursRow}>
        <Text style={{ width: 170 }}>Official hours for arrival and departure</Text>
        <View>
          <Text>Regular days: {doc.office_hours.regular_days}</Text>
          <Text style={{ marginTop: 2 }}>Saturdays: {doc.office_hours.saturdays || "—"}</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={s.headerRow}>
          <View style={[s.cell, { width: COL_WIDTHS[0] }]}>
            <Text style={s.bold7}>Day</Text>
          </View>
          <HeaderGroup label="A.M." sub={["Arrival", "Departure"]} widths={[COL_WIDTHS[1], COL_WIDTHS[2]]} />
          <HeaderGroup label="P.M." sub={["Arrival", "Departure"]} widths={[COL_WIDTHS[3], COL_WIDTHS[4]]} />
          <HeaderGroup label="Undertime" sub={["Hours", "Minutes"]} widths={[COL_WIDTHS[5], COL_WIDTHS[6]]} last />
        </View>
        {doc.rows.map((row) => (
          <PdfRow key={row.day} row={row} />
        ))}
        <View style={s.totalRow}>
          <View style={{ width: COL_WIDTHS[0] + COL_WIDTHS[1] * 4, justifyContent: "center", paddingLeft: 200, borderRightWidth: 0.4, borderColor: "black" }}>
            <Text style={s.totalText}>TOTAL</Text>
          </View>
          <Cell width={COL_WIDTHS[5]} text={String(doc.totals.undertime_hours)} bold />
          <Cell width={COL_WIDTHS[6]} text={String(doc.totals.undertime_minutes)} bold last />
        </View>
      </View>

      <Text style={s.cert}>{doc.certification}</Text>
      <View style={[s.signLine, { marginTop: 12 }]} />
      <Text style={s.signLabel}>(Signature)</Text>
      <Text style={s.verified}>{doc.verified_label}</Text>
      <View style={[s.signLine, { marginTop: 12 }]} />
      <Text style={s.signLabel}>In Charge</Text>
    </View>
  );
}

export function DtrPdfDocument({ docs }: { docs: DtrDocument[] }) {
  const title = docs.length === 1 ? `DTR ${docs[0]!.employee.full_name} ${docs[0]!.period.label}` : "DTR batch";
  return (
    <Document title={title} creator="BHW QR Attendance System" producer="BHW QR Attendance System">
      {docs.map((doc) => (
        <Page key={doc.employee.id} size="A4" orientation="landscape" style={s.page}>
          <Copy doc={doc} left={25} />
          <Copy doc={doc} left={436} />
        </Page>
      ))}
    </Document>
  );
}

/** One A4 landscape page (two copies) per document. */
export async function renderDtrPdfBlob(docs: DtrDocument[]): Promise<Blob> {
  return pdf(<DtrPdfDocument docs={docs} />).toBlob();
}
