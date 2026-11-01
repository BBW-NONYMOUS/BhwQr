import type { CorrectionRequestInput, CorrectionStatus, CorrectionType, Database } from "@bhw/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

import { DEFAULT_CORRECTION_WINDOW_DAYS } from "@/components/correction/eligibility";
import { attachmentPath, type PickedAttachment } from "@/components/correction/validate";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

import { AppError, fetchWithSnapshot, historyKeys, offlineQueryOptions, toAppError } from "./history";

const ATTACHMENT_BUCKET = "correction-attachments";

/** Row shown on My Requests (own rows only, RLS `corrections_select_own`). */
export interface CorrectionRequestRow {
  id: string;
  work_date: string;
  type: CorrectionType;
  requested_time_in: string | null;
  requested_time_out: string | null;
  reason: string;
  attachment_url: string | null;
  status: CorrectionStatus;
  remarks: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export const requestKeys = {
  all: ["requests"] as const,
  mine: (uid: string) => ["requests", uid] as const,
  window: ["app_settings", "correction_window_days"] as const,
};

export async function fetchMyRequests(uid: string): Promise<CorrectionRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("correction_requests")
    .select("id, work_date, type, requested_time_in, requested_time_out, reason, attachment_url, status, remarks, created_at, reviewed_at")
    .eq("employee_id", uid)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw toAppError(error);
  return data ?? [];
}

export function useMyRequests() {
  const { profile } = useSession();
  const uid = profile?.id ?? "";
  const key = requestKeys.mine(uid);
  return useQuery({
    queryKey: key,
    enabled: uid !== "",
    queryFn: () => fetchWithSnapshot(key, () => fetchMyRequests(uid)),
    ...offlineQueryOptions,
  });
}

/** `app_settings.correction_window_days` (D-26); falls back to the default while loading/offline. */
export function useCorrectionWindowDays(): number {
  const { data } = useQuery({
    queryKey: requestKeys.window,
    queryFn: async () => {
      const { data: row, error } = await getSupabase().from("app_settings").select("correction_window_days").eq("id", 1).single();
      if (error) throw toAppError(error);
      return row.correction_window_days;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  return data ?? DEFAULT_CORRECTION_WINDOW_DAYS;
}

/** Uploads the attachment into the user's own folder and returns the storage path. */
async function uploadAttachment(uid: string, attachment: PickedAttachment): Promise<string> {
  const path = attachmentPath(uid, Crypto.randomUUID(), attachment.name);
  let bytes: Uint8Array;
  try {
    bytes = await new File(attachment.uri).bytes();
  } catch (e) {
    throw new AppError("ATTACHMENT_UNREADABLE", e instanceof Error ? e.message : String(e));
  }
  const { error } = await getSupabase()
    .storage.from(ATTACHMENT_BUCKET)
    .upload(path, bytes, { contentType: attachment.mimeType, upsert: false });
  if (error) throw toAppError(error);
  return path;
}

type FileCorrectionArgs = Database["public"]["Functions"]["file_correction_request"]["Args"];

/**
 * Files a correction (core flow 6): optional attachment upload, then `file_correction_request`.
 * If the RPC rejects the request, the just-uploaded attachment is removed again.
 */
export function useFileCorrection() {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, attachment }: { input: CorrectionRequestInput; attachment: PickedAttachment | null }) => {
      const uid = profile?.id;
      if (!uid) throw new AppError("AUTH_REQUIRED");
      const path = attachment ? await uploadAttachment(uid, attachment) : null;
      // The SQL function accepts NULL times and attachment, but the generated Args type marks
      // them as required strings; the shape below is the real contract.
      const args = {
        p_work_date: input.workDate,
        p_type: input.type,
        p_time_in: input.requestedTimeIn,
        p_time_out: input.requestedTimeOut,
        p_reason: input.reason,
        p_attachment_path: path,
      } satisfies Record<keyof FileCorrectionArgs, string | null>;
      const { data, error } = await getSupabase().rpc("file_correction_request", args as FileCorrectionArgs);
      if (error) {
        if (path) await getSupabase().storage.from(ATTACHMENT_BUCKET).remove([path]).catch(() => undefined);
        throw toAppError(error);
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      void queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

export function useCancelCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await getSupabase().rpc("cancel_correction_request", { p_request_id: requestId });
      if (error) throw toAppError(error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      void queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}
