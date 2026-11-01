import { checkCorrectionDate, isFutureTime, normalizeHhmm, timeFieldsFor } from "@/components/correction/eligibility";
import { attachmentPath, checkAttachment, validateCorrection, type CorrectionFormValues } from "@/components/correction/validate";

describe("checkCorrectionDate (D-26)", () => {
  it("accepts any past day of the current month, including today", () => {
    expect(checkCorrectionDate("2026-11-01", "2026-11-20", 5)).toEqual({ ok: true });
    expect(checkCorrectionDate("2026-11-20", "2026-11-20", 5)).toEqual({ ok: true });
  });

  it("rejects future dates", () => {
    expect(checkCorrectionDate("2026-11-21", "2026-11-20", 5)).toEqual({ ok: false, reason: "future" });
  });

  it("accepts last month only while today <= correction_window_days", () => {
    expect(checkCorrectionDate("2026-10-15", "2026-11-05", 5)).toEqual({ ok: true });
    expect(checkCorrectionDate("2026-10-15", "2026-11-06", 5)).toEqual({ ok: false, reason: "too_old" });
    expect(checkCorrectionDate("2026-10-31", "2026-11-01", 0)).toEqual({ ok: false, reason: "too_old" });
  });

  it("handles the January → December year boundary", () => {
    expect(checkCorrectionDate("2026-12-31", "2027-01-03", 5)).toEqual({ ok: true });
  });

  it("never accepts two months back", () => {
    expect(checkCorrectionDate("2026-09-30", "2026-11-01", 15)).toEqual({ ok: false, reason: "too_old" });
  });

  it("rejects malformed and impossible dates", () => {
    expect(checkCorrectionDate("2026-11-1", "2026-11-20", 5)).toEqual({ ok: false, reason: "invalid" });
    expect(checkCorrectionDate("2026-02-30", "2026-03-02", 5)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("time helpers", () => {
  it("normalises typed times to HH:mm", () => {
    expect(normalizeHhmm("8:05")).toBe("08:05");
    expect(normalizeHhmm("0805")).toBe("08:05");
    expect(normalizeHhmm("805")).toBe("08:05");
    expect(normalizeHhmm("17.30")).toBe("17:30");
    expect(normalizeHhmm("25:00")).toBe("25:00");
    expect(normalizeHhmm("abc")).toBe("abc");
  });

  it("detects times later than now on today's date only", () => {
    expect(isFutureTime("2026-11-05", "17:00", "2026-11-05", "09:00")).toBe(true);
    expect(isFutureTime("2026-11-05", "08:00", "2026-11-05", "09:00")).toBe(false);
    expect(isFutureTime("2026-11-04", "23:00", "2026-11-05", "09:00")).toBe(false);
  });

  it("shows the time fields that belong to each type", () => {
    expect(timeFieldsFor("missing_time_in")).toEqual({ timeIn: true, timeOut: false });
    expect(timeFieldsFor("missing_time_out")).toEqual({ timeIn: false, timeOut: true });
    expect(timeFieldsFor("wrong_time")).toEqual({ timeIn: true, timeOut: true });
    expect(timeFieldsFor(null)).toEqual({ timeIn: false, timeOut: false });
  });
});

describe("validateCorrection", () => {
  const ctx = { today: "2026-11-05", nowHhmm: "10:00", windowDays: 5, lang: "en" as const };
  const base: CorrectionFormValues = {
    workDate: "2026-11-04",
    type: "missing_time_out",
    timeIn: "",
    timeOut: "17:05",
    reason: "Phone battery died before I could scan out.",
  };

  it("returns the schema value for a valid request", () => {
    const r = validateCorrection(base, ctx);
    expect(r).toEqual({
      ok: true,
      value: {
        workDate: "2026-11-04",
        type: "missing_time_out",
        requestedTimeIn: null,
        requestedTimeOut: "17:05",
        reason: "Phone battery died before I could scan out.",
        attachmentPath: null,
      },
    });
  });

  it("requires the time that matches the type and a 10-character reason", () => {
    const r = validateCorrection({ ...base, timeOut: "", reason: "late" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.requestedTimeOut).toBe("Enter the time-out");
      expect(r.errors.reason).toBe("Please enter a reason of at least 10 characters");
    }
  });

  it("translates messages to Filipino", () => {
    const r = validateCorrection({ ...base, type: "wrong_time", timeIn: "17:00", timeOut: "08:00" }, { ...ctx, lang: "fil" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.requestedTimeOut).toBe("Dapat mas huli ang time-out kaysa sa time-in");
  });

  it("rejects a type-less form, an ineligible date and a future time", () => {
    const r = validateCorrection({ ...base, type: null, workDate: "2026-09-30" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.type).toBeDefined();
      expect(r.errors.workDate).toContain("too old");
    }
    const future = validateCorrection({ ...base, workDate: "2026-11-05", timeOut: "17:05" }, ctx);
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.errors.requestedTimeOut).toContain("has not happened yet");
  });

  it("allows official business with both times blank", () => {
    expect(validateCorrection({ ...base, type: "official_business", timeOut: "" }, ctx).ok).toBe(true);
  });
});

describe("attachments", () => {
  it("accepts images and PDFs up to 5 MB only", () => {
    expect(checkAttachment({ size: 1_000_000, mimeType: "image/jpeg" }, "en")).toBeNull();
    expect(checkAttachment({ size: 1_000_000, mimeType: "application/pdf" }, "en")).toBeNull();
    expect(checkAttachment({ size: 6 * 1024 * 1024, mimeType: "image/png" }, "en")).toContain("5 MB");
    expect(checkAttachment({ size: 1000, mimeType: "image/heic" }, "en")).toContain("JPG");
  });

  it("builds a storage path inside the user's own folder", () => {
    expect(attachmentPath("uid-1", "key-1", "logbook page (1).jpg")).toBe("uid-1/key-1/logbook_page_1_.jpg");
  });
});
