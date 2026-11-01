import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Barangay Health Workers of Barangay Kalawag II: register for the QR attendance system.",
};

export default function RegisterPage() {
  return (
    <AuthShell width="wide">
      <RegisterForm />
    </AuthShell>
  );
}
