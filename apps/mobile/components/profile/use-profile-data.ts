import { useQuery } from "@tanstack/react-query";

import { toAppError } from "@/lib/queries/history";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

/** Signed URL (≤ 60 min, D-31) for the private profile photo, or null when there is none. */
export function useProfilePhotoUrl(): string | null {
  const { profile } = useSession();
  const path = profile?.photo_url ?? null;
  const { data } = useQuery({
    queryKey: ["profile-photo", path],
    enabled: path !== null,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (/^https?:\/\//.test(path)) return path;
      const { data: signed, error } = await getSupabase().storage.from("profile-photos").createSignedUrl(path, 60 * 60);
      if (error) throw toAppError(error);
      return signed.signedUrl;
    },
  });
  return data ?? null;
}

export interface BoundDevice {
  model: string | null;
  platform: string;
  bound_at: string;
}

/** The employee's active phone binding (RLS `devices_select_own`). */
export function useBoundDevice() {
  const { profile } = useSession();
  const uid = profile?.id ?? "";
  return useQuery({
    queryKey: ["bound-device", uid],
    enabled: uid !== "",
    queryFn: async (): Promise<BoundDevice | null> => {
      const { data, error } = await getSupabase()
        .from("devices")
        .select("model, platform, bound_at")
        .eq("employee_id", uid)
        .is("revoked_at", null)
        .order("bound_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw toAppError(error);
      return data;
    },
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/** "Maria Luz D. Santos" → "MS". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter((p) => /^[A-Za-zÀ-ÿÑñ]/.test(p) && !/\.$/.test(p));
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
