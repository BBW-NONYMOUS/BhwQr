// generate-dtr-pdf (core flow 7, FR-81): CSC Form No. 48 as PDF for the mobile app (My DTR →
// Download) and for batch printing. Data comes only from get_dtr / get_dtr_batch, called with the
// caller's own JWT so the same access rules apply (employee: own; admin: any / batch).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { preflight, corsHeaders } from "../_shared/cors.ts";
import { fail, failFromDb, readJson } from "../_shared/http.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { dtrPdfRequestSchema } from "../_shared/schemas.ts";
import { bearerToken, getCaller, logError } from "../_shared/supabase.ts";
import { renderDtrPdf, type DtrDocument } from "./render.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const user = await getCaller(req);
    if (!user) return fail(req, "AUTH_REQUIRED");
    if (!rateLimit(`dtr:${user.id}`, 10, 60_000)) return fail(req, "RATE_LIMITED");
    const parsed = dtrPdfRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(req, "INVALID_REQUEST");

    // User-scoped client: get_dtr checks auth.uid() itself.
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${bearerToken(req)}` } },
      auth: { persistSession: false },
    });
    const { year, month } = parsed.data;
    let docs: DtrDocument[];
    if (parsed.data.employeeId) {
      const { data, error } = await db.rpc("get_dtr", {
        p_employee_id: parsed.data.employeeId, p_year: year, p_month: month,
      });
      if (error) return failFromDb(req, error);
      docs = [data as DtrDocument];
    } else {
      const { data, error } = await db.rpc("get_dtr_batch", { p_year: year, p_month: month });
      if (error) return failFromDb(req, error);
      docs = data as DtrDocument[];
    }

    const pdf = await renderDtrPdf(docs);
    const name = docs.length === 1
      ? `DTR-${docs[0]!.employee.bhw_id_number ?? "employee"}-${year}-${String(month).padStart(2, "0")}.pdf`
      : `DTR-batch-${year}-${String(month).padStart(2, "0")}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...corsHeaders(req),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (e) {
    await logError("generate-dtr-pdf failed", { error: String(e) });
    return fail(req, "INTERNAL_ERROR");
  }
});
