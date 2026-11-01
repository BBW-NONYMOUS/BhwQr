"use server";

import { registrationSchema, type RegistrationInput } from "@bhw/types";
import { redirect } from "next/navigation";

import { authMessage } from "@/components/auth/auth-messages";
import {
  fieldErrorsFrom,
  loginSchema,
  newPasswordSchema,
  passwordResetSchema,
  type LoginInput,
  type NewPasswordInput,
  type PasswordResetInput,
  type PhotoMeta,
  type RegisterResult,
} from "@/components/auth/schemas";
import { ok, type ActionResult } from "@/lib/actions";
import { postLoginDestination } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import {
  checkPhotoFile,
  isRegistrationPhotoPath,
  registrationPhotoPath,
} from "@/lib/registration-photo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PHOTO_BUCKET = "profile-photos";
/** A registration photo can be attached only shortly after sign-up. */
const PHOTO_ATTACH_WINDOW_MS = 60 * 60 * 1000;

function authFail(code: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return {
    ok: false,
    code,
    message: authMessage(code).en,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

function authErrorCode(error: AuthErrorLike): string {
  if (error.status === 429 || error.code?.startsWith("over_")) return "RATE_LIMITED";
  switch (error.code) {
    case "invalid_credentials":
      return "INVALID_CREDENTIALS";
    case "email_not_confirmed":
      return "EMAIL_NOT_CONFIRMED";
    case "weak_password":
      return "WEAK_PASSWORD";
    case "same_password":
      return "SAME_PASSWORD";
    case "user_already_exists":
    case "email_exists":
      return "EMAIL_TAKEN";
    default:
      return "INTERNAL_ERROR";
  }
}

/** The service-role key is optional in development; without it photo upload is skipped. */
function serviceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

// ---------------------------------------------------------------------------------------------
// Sign in / password
// ---------------------------------------------------------------------------------------------

/** Signs in with e-mail + password and redirects by status/role. Returns only on failure. */
export async function signInAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return authFail("CHECK_FIELDS", fieldErrorsFrom(parsed.error.issues));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return authFail(error ? authErrorCode(error) : "INTERNAL_ERROR");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  const destination = postLoginDestination(profile, parsed.data.next);
  if (destination.kind === "error") {
    await supabase.auth.signOut();
    return authFail(destination.code === "inactive" ? "ACCOUNT_INACTIVE" : "PROFILE_NOT_FOUND");
  }
  redirect(destination.to);
}

/**
 * Sends a password-reset e-mail. Always answers with the same success message so the form
 * cannot be used to find out which e-mails are registered.
 */
export async function requestPasswordResetAction(input: PasswordResetInput): Promise<ActionResult> {
  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) return authFail("CHECK_FIELDS", fieldErrorsFrom(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/login/new-password`,
  });
  if (error && authErrorCode(error) === "RATE_LIMITED") return authFail("RATE_LIMITED");
  return ok(undefined, "If an account uses this email, we sent a link to reset the password.");
}

/**
 * Sends the sign-up verification e-mail again (the first link expires after an hour). Same
 * neutral answer as the password reset so it does not reveal which e-mails are registered.
 */
export async function resendVerificationAction(input: PasswordResetInput): Promise<ActionResult> {
  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) return authFail("CHECK_FIELDS", fieldErrorsFrom(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/pending` },
  });
  if (error && authErrorCode(error) === "RATE_LIMITED") return authFail("RATE_LIMITED");
  return ok(undefined, "If this email is waiting for verification, we sent a new link.");
}

/** Sets a new password for the signed-in user (after opening the reset link). */
export async function updatePasswordAction(input: NewPasswordInput): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return authFail("CHECK_FIELDS", fieldErrorsFrom(parsed.error.issues));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return authFail("AUTH_REQUIRED");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const code = authErrorCode(error);
    return code === "WEAK_PASSWORD" || code === "SAME_PASSWORD"
      ? authFail(code, { password: authMessage(code).en })
      : authFail(code);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  const destination = postLoginDestination(profile);
  if (destination.kind === "error") {
    await supabase.auth.signOut();
    redirect(`/login?error=${destination.code}`);
  }
  redirect(destination.to);
}

// ---------------------------------------------------------------------------------------------
// Registration (core flow 1, FR-01..FR-10, BR-05..BR-11)
// ---------------------------------------------------------------------------------------------

/**
 * Creates the pending employee account. The `handle_new_user` trigger creates the profile,
 * encrypts contact number and address, and sets `consent_at`. When a photo was chosen and the
 * service-role key is configured, returns a one-time signed upload URL for it.
 */
export async function registerAction(
  input: RegistrationInput,
  photo: PhotoMeta | null,
): Promise<ActionResult<RegisterResult>> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    if (fieldErrors.consent && Object.keys(fieldErrors).length === 1)
      return authFail("CONSENT_REQUIRED", fieldErrors);
    return authFail("CHECK_FIELDS", fieldErrors);
  }
  const values = parsed.data;

  // Every employee has a profile photo (BR-12a).
  if (!photo) return authFail("PHOTO_REQUIRED", { photo: authMessage("PHOTO_REQUIRED").en });
  const photoType = checkPhotoFile(photo);
  if (!photoType.ok) return authFail(photoType.code, { photo: photoType.message });

  const supabase = await createClient();
  const { data: taken, error: checkError } = await supabase.rpc("check_registration_available", {
    p_bhw_id_number: values.bhwIdNumber,
    p_email: values.email,
  });
  if (checkError) return authFail("INTERNAL_ERROR");
  if (taken === "BHW_ID_TAKEN") return authFail(taken, { bhwIdNumber: authMessage(taken).en });
  if (taken === "EMAIL_TAKEN") return authFail(taken, { email: authMessage(taken).en });

  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL;
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/pending`,
      data: {
        full_name: values.fullName,
        bhw_id_number: values.bhwIdNumber,
        area: values.area,
        contact_number: values.contactNumber,
        ...(values.address ? { address: values.address } : {}),
        consent: true,
      },
    },
  });
  if (error) {
    const code = authErrorCode(error);
    if (code === "EMAIL_TAKEN") return authFail(code, { email: authMessage(code).en });
    if (code === "WEAK_PASSWORD") return authFail(code, { password: authMessage(code).en });
    return authFail(code);
  }
  const user = data.user;
  // With e-mail confirmation on, Supabase hides "already registered" behind a user with no identities.
  if (!user || (user.identities && user.identities.length === 0)) {
    return authFail("EMAIL_TAKEN", { email: authMessage("EMAIL_TAKEN").en });
  }

  const result: RegisterResult = {
    userId: user.id,
    email: values.email,
    signedIn: data.session !== null,
    photoUpload: null,
    // Signed in: the browser uploads with the new session (lib/own-photo.ts).
    photo: data.session ? "ready" : "unavailable",
  };

  if (!result.signedIn && serviceRoleConfigured()) {
    try {
      const path = registrationPhotoPath(user.id, photoType.type);
      const { data: signed, error: signError } = await createAdminClient()
        .storage.from(PHOTO_BUCKET)
        .createSignedUploadUrl(path);
      if (!signError && signed) {
        result.photoUpload = { path: signed.path, token: signed.token };
        result.photo = "ready";
      }
    } catch (e) {
      console.error("registerAction: could not prepare photo upload", e);
    }
  }

  return ok(result);
}

/**
 * Links an uploaded registration photo to the new profile. Only works for a pending profile
 * without a photo, created within the last hour, for a file that exists in that user's folder
 * (which only the holder of the one-time upload token could have written).
 */
export async function attachRegistrationPhotoAction(input: {
  userId: string;
  path: string;
}): Promise<ActionResult> {
  if (!serviceRoleConfigured()) return authFail("PHOTO_UNAVAILABLE");
  if (!isRegistrationPhotoPath(input.userId, input.path)) return authFail("INVALID_REQUEST");

  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("status, photo_url, created_at")
      .eq("id", input.userId)
      .maybeSingle<{ status: string; photo_url: string | null; created_at: string }>();
    if (error) return authFail("INTERNAL_ERROR");
    if (
      !profile ||
      profile.status !== "pending" ||
      profile.photo_url !== null ||
      Date.now() - new Date(profile.created_at).getTime() > PHOTO_ATTACH_WINDOW_MS
    ) {
      return authFail("FORBIDDEN");
    }

    const { data: exists } = await admin.storage.from(PHOTO_BUCKET).exists(input.path);
    if (!exists) return authFail("NOT_FOUND");

    const { error: updateError } = await admin
      .from("profiles")
      .update({ photo_url: input.path })
      .eq("id", input.userId)
      .is("photo_url", null);
    if (updateError) return authFail("INTERNAL_ERROR");
    return ok(undefined, "Photo saved.");
  } catch (e) {
    console.error("attachRegistrationPhotoAction failed", e);
    return authFail("PHOTO_UNAVAILABLE");
  }
}
