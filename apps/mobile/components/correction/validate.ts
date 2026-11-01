import {
  ATTACHMENT_MIME_TYPES,
  PHOTO_MAX_BYTES,
  correctionRequestSchema,
  type CorrectionRequestInput,
  type CorrectionType,
} from "@bhw/types";

import type { Lang } from "@/lib/messages";

import { checkCorrectionDate, dateEligibilityMessage, isFutureTime, normalizeHhmm, timeFieldsFor } from "./eligibility";

export type CorrectionField = "workDate" | "type" | "requestedTimeIn" | "requestedTimeOut" | "reason" | "attachment";

export interface CorrectionFormValues {
  workDate: string;
  type: CorrectionType | null;
  timeIn: string;
  timeOut: string;
  reason: string;
}

export interface PickedAttachment {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export type CorrectionValidation =
  | { ok: true; value: CorrectionRequestInput }
  | { ok: false; errors: Partial<Record<CorrectionField, string>> };

/** Filipino versions of the English messages in `correctionRequestSchema` (@bhw/types). */
const SCHEMA_MESSAGES_FIL: Record<string, string> = {
  "Use YYYY-MM-DD": "Gamitin ang YYYY-MM-DD",
  "Use HH:mm (24-hour)": "Gamitin ang HH:mm (24 oras), halimbawa 08:00 o 17:05",
  "Enter the time-in": "Ilagay ang oras ng time-in",
  "Enter the time-out": "Ilagay ang oras ng time-out",
  "Enter the correct time-in, time-out, or both": "Ilagay ang tamang time-in, time-out, o pareho",
  "Time-out must be later than time-in": "Dapat mas huli ang time-out kaysa sa time-in",
  "Please enter a reason of at least 10 characters": "Maglagay ng dahilan na hindi bababa sa 10 titik",
  "Reason must be at most 500 characters": "Hanggang 500 titik lamang ang dahilan",
};

const SCHEMA_MESSAGES_EN: Record<string, string> = {
  "Use HH:mm (24-hour)": "Use HH:mm (24-hour), for example 08:00 or 17:05",
};

function translate(message: string, lang: Lang): string {
  if (lang === "fil") return SCHEMA_MESSAGES_FIL[message] ?? message;
  return SCHEMA_MESSAGES_EN[message] ?? message;
}

const LOCAL_MESSAGES = {
  typeRequired: { en: "Choose what needs to be corrected.", fil: "Piliin kung ano ang itatama." },
  futureTime: {
    en: "This time has not happened yet. Enter a time that already passed.",
    fil: "Hindi pa nangyayari ang oras na ito. Maglagay ng oras na lumipas na.",
  },
} as const;

/**
 * Validates the correction form with `correctionRequestSchema` plus the D-26 date window and the
 * "no future time" rule, returning bilingual field messages for gluestack FormControl.
 */
export function validateCorrection(
  values: CorrectionFormValues,
  ctx: { today: string; nowHhmm: string; windowDays: number; lang: Lang },
): CorrectionValidation {
  const errors: Partial<Record<CorrectionField, string>> = {};
  const { lang } = ctx;

  const date = checkCorrectionDate(values.workDate.trim(), ctx.today, ctx.windowDays);
  if (!date.ok) errors.workDate = dateEligibilityMessage(date.reason, ctx.windowDays, lang);
  if (!values.type) errors.type = LOCAL_MESSAGES.typeRequired[lang];

  const shown = timeFieldsFor(values.type);
  const timeIn = shown.timeIn && values.timeIn.trim() ? normalizeHhmm(values.timeIn) : null;
  const timeOut = shown.timeOut && values.timeOut.trim() ? normalizeHhmm(values.timeOut) : null;

  const parsed = correctionRequestSchema.safeParse({
    workDate: values.workDate.trim(),
    type: values.type ?? undefined,
    requestedTimeIn: timeIn,
    requestedTimeOut: timeOut,
    reason: values.reason,
    attachmentPath: null,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "workDate" || field === "type") continue; // already reported with our own wording
      if (field === "requestedTimeIn" || field === "requestedTimeOut" || field === "reason") {
        errors[field] ??= translate(issue.message, lang);
      }
    }
  }

  if (!errors.workDate) {
    const workDate = values.workDate.trim();
    if (timeIn && !errors.requestedTimeIn && isFutureTime(workDate, timeIn, ctx.today, ctx.nowHhmm)) {
      errors.requestedTimeIn = LOCAL_MESSAGES.futureTime[lang];
    }
    if (timeOut && !errors.requestedTimeOut && isFutureTime(workDate, timeOut, ctx.today, ctx.nowHhmm)) {
      errors.requestedTimeOut = LOCAL_MESSAGES.futureTime[lang];
    }
  }

  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, value: parsed.data };
}

/** Attachment rule (D-26): JPG/PNG/WebP image or PDF, at most 5 MB (bucket `correction-attachments`). */
export function checkAttachment(file: { size: number | null | undefined; mimeType: string | null | undefined }, lang: Lang): string | null {
  const allowed: readonly string[] = ATTACHMENT_MIME_TYPES;
  if (!file.mimeType || !allowed.includes(file.mimeType)) {
    return lang === "fil"
      ? "JPG, PNG, WebP na larawan o PDF lamang ang puwede."
      : "Only a JPG, PNG or WebP photo, or a PDF, can be attached.";
  }
  if (file.size == null || file.size > PHOTO_MAX_BYTES) {
    return lang === "fil" ? "Dapat 5 MB o mas maliit ang file." : "The file must be 5 MB or smaller.";
  }
  return null;
}

/** Storage object path: `<uid>/<requestKey>/<safe file name>` (first folder must be the user's id). */
export function attachmentPath(uid: string, requestKey: string, fileName: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-80);
  return `${uid}/${requestKey}/${safe || "attachment"}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
