import { PHOTO_MIME_TYPES, photoFileSchema } from "@bhw/types";

/**
 * Profile photo rules for /register (BR-09): JPEG, PNG or WebP, checked by MIME type AND file
 * extension, at most 5 MB. Stored in the private `profile-photos` bucket at
 * `<userId>/photo-<timestamp>.<ext>`, which matches the `profiles.photo_url` check constraint.
 */

export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

const EXTENSIONS_BY_TYPE: Record<PhotoMimeType, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

const STORED_EXTENSION: Record<PhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface PhotoFileLike {
  name: string;
  type: string;
  size: number;
}

export type PhotoCheck =
  | { ok: true; type: PhotoMimeType }
  | { ok: false; code: "FILE_TYPE_NOT_ALLOWED" | "FILE_TOO_LARGE"; message: string };

function isPhotoMimeType(type: string): type is PhotoMimeType {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(type);
}

/** Validates a chosen photo with the shared photoFileSchema plus the extension check of BR-09. */
export function checkPhotoFile(file: PhotoFileLike): PhotoCheck {
  const parsed = photoFileSchema.safeParse({ size: file.size, type: file.type });
  if (!parsed.success) {
    const sizeIssue = parsed.error.issues.find((issue) => issue.path[0] === "size");
    if (sizeIssue && isPhotoMimeType(file.type)) {
      return { ok: false, code: "FILE_TOO_LARGE", message: sizeIssue.message };
    }
    const typeIssue = parsed.error.issues.find((issue) => issue.path[0] === "type");
    return {
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
      message: typeIssue?.message ?? "Use a JPG, PNG or WebP image",
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS_BY_TYPE[parsed.data.type].includes(extension)) {
    return { ok: false, code: "FILE_TYPE_NOT_ALLOWED", message: "Use a JPG, PNG or WebP image" };
  }
  if (file.size <= 0) {
    return {
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
      message: "This file is empty. Please choose another photo.",
    };
  }
  return { ok: true, type: parsed.data.type };
}

/** Storage path for a new registration photo. */
export function registrationPhotoPath(
  userId: string,
  type: PhotoMimeType,
  now: number = Date.now(),
): string {
  return `${userId}/photo-${now}.${STORED_EXTENSION[type]}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True only for a path created by registrationPhotoPath for this exact user. */
export function isRegistrationPhotoPath(userId: string, path: string): boolean {
  if (!UUID.test(userId)) return false;
  const [folder, file, ...rest] = path.split("/");
  return (
    folder === userId && rest.length === 0 && /^photo-\d{10,16}\.(jpg|png|webp)$/.test(file ?? "")
  );
}
