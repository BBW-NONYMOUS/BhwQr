import { isErrorCode } from "@bhw/types";

import { createClient } from "@/lib/supabase/client";
import { checkPhotoFile, registrationPhotoPath } from "@/lib/registration-photo";

export type OwnPhotoResult = { ok: true; path: string } | { ok: false; code: string };

/**
 * Uploads a profile photo for the signed-in employee (BR-12a, FR-18): the file goes to their own
 * folder in the private `profile-photos` bucket (storage_owner_insert) and `set_my_photo` links
 * it to the profile. Works for pending and active employees without the service-role key.
 */
export async function uploadOwnPhoto(file: File): Promise<OwnPhotoResult> {
  const check = checkPhotoFile(file);
  if (!check.ok) return { ok: false, code: check.code };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "AUTH_REQUIRED" };

  const path = registrationPhotoPath(user.id, check.type);
  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, code: "INTERNAL_ERROR" };

  const { error } = await supabase.rpc("set_my_photo", { p_path: path });
  if (error)
    return { ok: false, code: isErrorCode(error.message) ? error.message : "INTERNAL_ERROR" };
  return { ok: true, path };
}
