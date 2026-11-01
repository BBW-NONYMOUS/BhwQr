import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.118.0";

let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS – only used inside Edge Functions, never sent to clients. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return admin;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

/** Validates the caller's JWT with Supabase Auth. Returns null for missing/invalid/expired tokens. */
export async function getCaller(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Caller's user id from a locally verified JWT (getClaims uses the project's cached signing keys,
 * so no Auth round trip on asymmetric-key projects). Status and role are checked in SQL anyway.
 */
export async function getCallerId(req: Request): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await adminClient().auth.getClaims(token);
  const sub = data?.claims?.sub;
  return error || typeof sub !== "string" ? null : sub;
}

export interface CallerProfile {
  id: string;
  role: "admin" | "employee" | "kiosk" | "viewer";
  status: "pending" | "active" | "rejected" | "inactive";
  full_name: string;
}

export async function getProfile(userId: string): Promise<CallerProfile | null> {
  const { data } = await adminClient()
    .from("profiles")
    .select("id, role, status, full_name")
    .eq("id", userId)
    .maybeSingle();
  return (data as CallerProfile | null) ?? null;
}

/** Server-side error logging to error_logs (core flow 9). Never throws. */
export async function logError(
  message: string,
  context: Record<string, unknown> = {},
  severity: "info" | "warning" | "error" | "critical" = "error",
  userId: string | null = null,
): Promise<void> {
  try {
    await adminClient().from("error_logs").insert({
      source: "edge_function",
      severity,
      message: message.slice(0, 1000),
      context,
      user_id: userId,
    });
  } catch (e) {
    console.error("logError failed", e);
  }
}
