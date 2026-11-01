import { z } from "zod";

/** Form schemas for the auth screens (registration uses the shared `registrationSchema`). */

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(72, "Password must be at most 72 characters"),
  next: z.string().max(2048).optional(),
});
export type LoginInput = z.input<typeof loginSchema>;

export const passwordResetSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});
export type PasswordResetInput = z.input<typeof passwordResetSchema>;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type NewPasswordInput = z.input<typeof newPasswordSchema>;

export interface PhotoMeta {
  name: string;
  type: string;
  size: number;
}

export interface RegisterResult {
  userId: string;
  email: string;
  /** True when Supabase returned a session (e-mail confirmation turned off on the project). */
  signedIn: boolean;
  /** Signed upload URL token for the profile photo, or null when no photo or storage is unavailable. */
  photoUpload: { path: string; token: string } | null;
  /** "none": no photo chosen; "ready": upload with photoUpload; "unavailable": add it later. */
  photo: "none" | "ready" | "unavailable";
}

/** Seeded purok names offered as suggestions (free text is still allowed). */
export const PUROK_SUGGESTIONS = [
  "Purok Malipayon",
  "Purok Bagong Silang",
  "Purok Masagana",
  "Purok Kalinaw",
  "Purok Mabuhay",
] as const;

/** First message per field from a zod error, keyed by the top-level field name. */
export function fieldErrorsFrom(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
