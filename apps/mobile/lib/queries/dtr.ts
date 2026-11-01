import { ATTENDANCE_METHODS, ATTENDANCE_STATUSES, dtrRowSchema, isErrorCode } from "@bhw/types";
import { useQuery } from "@tanstack/react-query";
import { fetch as expoFetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { z } from "zod";

import type { DtrRowData, DtrTotals } from "@/components/dtr/format";
import { dtrFileName } from "@/components/dtr/format";
import { getEnv } from "@/lib/env";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

import { AppError, fetchWithSnapshot, offlineQueryOptions, toAppError } from "./history";

/** `get_dtr` document (09-data-dictionary.md §7.2). Parsed so a schema drift fails loudly, not silently. */
const dtrDocumentSchema = z.object({
  employee: z.object({ id: z.string(), full_name: z.string(), bhw_id_number: z.string().nullable() }),
  period: z.object({ year: z.number(), month: z.number(), label: z.string() }),
  office: z.object({ name: z.string(), address: z.string() }),
  office_hours: z.object({ regular_days: z.string(), saturdays: z.string() }),
  rows: z.array(
    dtrRowSchema.extend({
      work_date: z.string().nullable(),
      undertime_hours: z.number().nullable(),
      undertime_minutes: z.number().nullable(),
      status: z.enum(ATTENDANCE_STATUSES).nullable(),
      method: z.enum(ATTENDANCE_METHODS).nullable(),
    }),
  ),
  totals: z.object({
    undertime_total_minutes: z.number(),
    undertime_hours: z.number(),
    undertime_minutes: z.number(),
    days_present: z.number(),
    days_absent: z.number(),
    days_late: z.number(),
    days_undertime: z.number(),
    days_incomplete: z.number(),
  }),
  generated_at: z.string(),
});

export interface DtrDocument {
  employee: { id: string; full_name: string; bhw_id_number: string | null };
  period: { year: number; month: number; label: string };
  office: { name: string; address: string };
  office_hours: { regular_days: string; saturdays: string };
  rows: DtrRowData[];
  totals: DtrTotals;
  generated_at: string;
}

export const dtrKeys = {
  all: ["dtr"] as const,
  month: (uid: string, year: number, month: number) => ["dtr", uid, year, month] as const,
};

export async function fetchDtr(uid: string, year: number, month: number): Promise<DtrDocument> {
  const { data, error } = await getSupabase().rpc("get_dtr", { p_employee_id: uid, p_year: year, p_month: month });
  if (error) throw toAppError(error);
  const parsed = dtrDocumentSchema.safeParse(data);
  if (!parsed.success) throw new AppError("INTERNAL_ERROR", `Unexpected DTR shape: ${parsed.error.message}`);
  return parsed.data;
}

export function useDtr(year: number, month: number) {
  const { profile } = useSession();
  const uid = profile?.id ?? "";
  const key = dtrKeys.month(uid, year, month);
  return useQuery({
    queryKey: key,
    enabled: uid !== "",
    queryFn: () => fetchWithSnapshot(key, () => fetchDtr(uid, year, month)),
    ...offlineQueryOptions,
  });
}

/**
 * Downloads the CSC Form No. 48 PDF from `generate-dtr-pdf`, saves it in the cache directory and
 * opens the share sheet. `functions.invoke` would return a Blob, which React Native cannot turn
 * into bytes reliably, so the function is called with expo/fetch and the caller's access token.
 */
export async function downloadAndShareDtrPdf(args: {
  employeeId: string;
  bhwId: string | null;
  year: number;
  month: number;
  dialogTitle: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError("AUTH_REQUIRED");
  const env = getEnv();

  let response: Response;
  try {
    response = (await expoFetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-dtr-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Accept: "application/pdf",
      },
      body: JSON.stringify({ employeeId: args.employeeId, year: args.year, month: args.month }),
    })) as unknown as Response;
  } catch (e) {
    throw new AppError("OFFLINE", e instanceof Error ? e.message : String(e));
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!response.ok || !contentType.includes("application/pdf")) {
    const payload = (await response.json().catch(() => null)) as { code?: unknown } | null;
    const code = payload && typeof payload.code === "string" && isErrorCode(payload.code) ? payload.code : "INTERNAL_ERROR";
    throw new AppError(code, `generate-dtr-pdf responded ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File(Paths.cache, dtrFileName(args.bhwId, args.year, args.month));
  file.create({ overwrite: true });
  file.write(bytes);

  if (!(await Sharing.isAvailableAsync())) throw new AppError("SHARING_UNAVAILABLE");
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: args.dialogTitle });
}
