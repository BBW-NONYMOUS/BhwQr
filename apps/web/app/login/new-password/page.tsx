import type { Metadata } from "next";

import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

/**
 * Opened from the password-reset e-mail through /auth/callback, which signs the user in first.
 * Signed-out visitors are sent to /login by the proxy.
 */
export default function NewPasswordPage() {
  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <AuthHeading title="Set a new password" fil="Magtakda ng bagong password">
          <p className="text-muted-foreground text-sm">
            Use at least 8 characters.{" "}
            <span lang="fil">Gumamit ng hindi bababa sa 8 character.</span>
          </p>
        </AuthHeading>
        <NewPasswordForm />
      </div>
    </AuthShell>
  );
}
