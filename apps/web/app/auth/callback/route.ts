import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Landing point of Supabase Auth e-mail links (sign-up verification, password reset).
 * - PKCE links carry `?code=` → exchangeCodeForSession.
 * - Token-hash links carry `?token_hash=&type=` → verifyOtp.
 * Then redirects to `next`, but only to a same-site relative path (no open redirects).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const fallback = type === "recovery" ? "/login/new-password" : "/";
  const next = safeNext(searchParams.get("next"), fallback);

  const linkFailed = () => NextResponse.redirect(new URL("/login?error=link", origin));

  // Supabase appends error parameters when the link is expired or was already used.
  if (searchParams.get("error") || searchParams.get("error_code")) return linkFailed();

  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return linkFailed();
  } else if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return linkFailed();
  } else {
    return linkFailed();
  }

  return NextResponse.redirect(new URL(next, origin));
}
