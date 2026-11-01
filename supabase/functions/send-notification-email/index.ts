// send-notification-email (D-33): e-mails a registration or correction outcome through Resend.
// Called by the web Server Actions after approve/reject/review. Without RESEND_API_KEY it does
// nothing (in-app notifications are always written by the SQL RPCs).
import { preflight } from "../_shared/cors.ts";
import { fail, json, readJson } from "../_shared/http.ts";
import { adminClient, getCaller, getProfile, logError } from "../_shared/supabase.ts";
import { z } from "npm:zod@4.6.7";

const schema = z.object({
  userId: z.uuid(),
  kind: z.enum(["registration_approved", "registration_rejected", "correction_approved", "correction_rejected", "device_reset"]),
  detail: z.string().max(500).optional(),
});

const TEMPLATES: Record<z.infer<typeof schema>["kind"], { subject: string; en: string; fil: string }> = {
  registration_approved: {
    subject: "Your BHW Attendance account is approved",
    en: "Your registration was approved. Install the BHW Attendance app and log in to register your phone.",
    fil: "Naaprubahan na ang iyong rehistro. I-install ang BHW Attendance app at mag-login para mairehistro ang iyong telepono.",
  },
  registration_rejected: {
    subject: "Your BHW Attendance registration",
    en: "Your registration was not approved.",
    fil: "Hindi naaprubahan ang iyong rehistro.",
  },
  correction_approved: {
    subject: "Correction request approved",
    en: "Your correction request was approved. Your DTR now shows the corrected time.",
    fil: "Naaprubahan ang iyong correction request. Makikita na sa iyong DTR ang naitamang oras.",
  },
  correction_rejected: {
    subject: "Correction request not approved",
    en: "Your correction request was not approved.",
    fil: "Hindi naaprubahan ang iyong correction request.",
  },
  device_reset: {
    subject: "Your registered phone was reset",
    en: "The administrator reset your registered phone. Log in on your phone to register it again.",
    fil: "Ni-reset ng administrator ang iyong nakarehistrong telepono. Mag-login muli sa iyong telepono upang mairehistro ito.",
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const caller = await getCaller(req);
  if (!caller) return fail(req, "AUTH_REQUIRED");
  const callerProfile = await getProfile(caller.id);
  if (callerProfile?.role !== "admin" || callerProfile.status !== "active") return fail(req, "FORBIDDEN");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(req, "INVALID_REQUEST");

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json(req, { ok: true, sent: false, reason: "email disabled" });

  const { data: target } = await adminClient()
    .from("profiles").select("email, full_name").eq("id", parsed.data.userId).single();
  if (!target) return fail(req, "NOT_FOUND");

  const t = TEMPLATES[parsed.data.kind];
  const detail = parsed.data.detail ? `<p><strong>${escapeHtml(parsed.data.detail)}</strong></p>` : "";
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const html = `<p>Hello ${escapeHtml(target.full_name)},</p><p>${t.en}</p>${detail}<p><em>${t.fil}</em></p>` +
    `<p><a href="${appUrl}">${escapeHtml(appUrl)}</a></p><p>– Barangay Kalawag II BHW Office</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("NOTIFY_FROM_EMAIL") ?? "BHW Attendance <no-reply@example.com>",
      to: [target.email],
      subject: t.subject,
      html,
    }),
  });
  if (!res.ok) {
    await logError("Notification e-mail failed", { status: res.status, kind: parsed.data.kind }, "warning", parsed.data.userId);
    return json(req, { ok: true, sent: false, reason: `provider ${res.status}` });
  }
  return json(req, { ok: true, sent: true });
});
