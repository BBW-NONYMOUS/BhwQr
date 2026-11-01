import "server-only";

import { serverEnv } from "@/lib/env.server";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Signed URLs live 60 minutes (BR-09, D-31). */
const PHOTO_URL_TTL_SECONDS = 60 * 60;

/**
 * Signs profile-photo storage paths with the caller's session (the storage_admin_select policy
 * lets an admin read every photo). Returns path -> signed URL; paths that fail are left out so
 * the avatar falls back to initials.
 */
export async function signProfilePhotos(
  supabase: ServerClient,
  paths: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => typeof p === "string" && p.length > 0))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrls(unique, PHOTO_URL_TTL_SECONDS);
  if (error || !data) return urls;
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

/** True when SUPABASE_SERVICE_ROLE_KEY is configured (needed only to create staff accounts). */
export function hasServiceRoleKey(): boolean {
  try {
    serverEnv();
    return true;
  } catch {
    return false;
  }
}

export type NotificationEmailKind =
  | "registration_approved"
  | "registration_rejected"
  | "device_reset";

export interface EmailOutcome {
  sent: boolean;
  reason?: string;
}

/**
 * Calls the send-notification-email Edge Function with the admin's own session (D-33). E-mail is
 * best-effort: the SQL RPCs already wrote the in-app notification, so a failure never fails the
 * action; the caller only tells the admin that no e-mail went out.
 */
export async function sendNotificationEmail(
  supabase: ServerClient,
  userId: string,
  kind: NotificationEmailKind,
  detail?: string,
): Promise<EmailOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; sent?: boolean; reason?: string }>(
      "send-notification-email",
      { body: { userId, kind, ...(detail ? { detail: detail.slice(0, 500) } : {}) } },
    );
    if (error) return { sent: false, reason: "the e-mail service could not be reached" };
    if (data?.sent) return { sent: true };
    return { sent: false, reason: data?.reason === "email disabled" ? "e-mail is not configured" : data?.reason };
  } catch {
    return { sent: false, reason: "the e-mail service could not be reached" };
  }
}

/** Toast text for the e-mail outcome, or undefined when it was sent. */
export function emailNote(outcome: EmailOutcome): string | undefined {
  if (outcome.sent) return undefined;
  const why = outcome.reason ? ` (${outcome.reason})` : "";
  return `No e-mail was sent${why}. The in-app notification was delivered.`;
}
