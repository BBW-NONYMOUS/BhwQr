"use server";

import {
  ATTENDANCE_STATUSES,
  errorMessage,
  errorResponseSchema,
  fallbackScanRequestSchema,
} from "@bhw/types";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const successSchema = z.object({
  ok: z.literal(true),
  action: z.enum(["time_in", "time_out"]),
  /** Manila HH:mm of the scan, formatted by the server. */
  time: z.string(),
  status: z.enum(ATTENDANCE_STATUSES),
  employeeName: z.string(),
  stationName: z.string().optional(),
  message: z.string().optional(),
});

export type FallbackScanSuccess = Omit<z.infer<typeof successSchema>, "ok">;

/**
 * Result of one fallback scan. Failures carry the catalog code and its placeholder values so
 * the page can show the English and Filipino messages (errorMessage(code, lang, params)).
 */
export type FallbackScanResult =
  | { ok: true; data: FallbackScanSuccess }
  | { ok: false; code: string; message: string; params: Record<string, string | number> };

function failure(code: string, params: Record<string, string | number> = {}): FallbackScanResult {
  return { ok: false, code, message: errorMessage(code, "en", params), params };
}

/**
 * Fallback Scan (core flow 5, FR-63, FR-64): sends the employee's personal QR and the chosen
 * station to the record-fallback-scan Edge Function with the admin's own session token. The
 * function verifies signature, expiry and nonce reuse and records method fallback_personal_qr.
 */
export async function recordFallbackScanAction(input: unknown): Promise<FallbackScanResult> {
  const admin = await currentProfileWithRole(["admin"]);
  if (!admin) return failure("FORBIDDEN");

  const parsed = fallbackScanRequestSchema.safeParse(
    typeof input === "object" && input !== null && "token" in input && typeof input.token === "string"
      ? { ...input, token: input.token.trim() }
      : input,
  );
  if (!parsed.success) {
    const tokenIssue = parsed.error.issues.some((i) => i.path[0] === "token");
    return failure(tokenIssue ? "QR_INVALID" : "INVALID_REQUEST");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<unknown>("record-fallback-scan", {
    body: { token: parsed.data.token, stationId: parsed.data.stationId },
  });

  if (error) {
    // Non-2xx responses carry the shared error body { ok:false, code, message, params }.
    if (error instanceof FunctionsHttpError) {
      try {
        const body = errorResponseSchema.safeParse(await (error.context as Response).json());
        if (body.success) return failure(body.data.code, body.data.params ?? {});
      } catch {
        // Body was not JSON; fall through to the generic error.
      }
    }
    console.error("record-fallback-scan invoke failed", error);
    return failure("INTERNAL_ERROR");
  }

  const success = successSchema.safeParse(data);
  if (success.success) {
    revalidatePath("/admin/attendance");
    revalidatePath("/admin");
    const d = success.data;
    return {
      ok: true,
      data: {
        action: d.action,
        time: d.time,
        status: d.status,
        employeeName: d.employeeName,
        stationName: d.stationName,
        message: d.message,
      },
    };
  }
  const err = errorResponseSchema.safeParse(data);
  if (err.success) return failure(err.data.code, err.data.params ?? {});

  console.error("record-fallback-scan returned an unexpected body", data);
  return failure("INTERNAL_ERROR");
}
