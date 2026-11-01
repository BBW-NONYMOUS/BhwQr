"use client";

import { Camera, ImageUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { authMessage, type BilingualText } from "@/components/auth/auth-messages";
import { FormStatus } from "@/components/auth/form-status";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadOwnPhoto } from "@/lib/own-photo";
import { checkPhotoFile } from "@/lib/registration-photo";
import { reportClientError } from "@/lib/report-error";

type Status = { tone: "error" | "success"; text: BilingualText } | null;

const SAVED: BilingualText = {
  en: "Photo saved.",
  fil: "Naisave ang larawan.",
};

/**
 * The employee's own profile photo with an add/replace button (BR-12a, FR-18). Used on /pending,
 * where a missing photo blocks approval, and on /me.
 */
export function ProfilePhotoCard({
  name,
  photoUrl,
  hasPhoto,
}: {
  name: string;
  /** Signed URL of the current photo, if it could be signed. */
  photoUrl: string | null;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    const check = checkPhotoFile(file);
    if (!check.ok) {
      setStatus({ tone: "error", text: { en: check.message, fil: authMessage(check.code).fil } });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await uploadOwnPhoto(file);
        if (!result.ok) {
          setStatus({ tone: "error", text: authMessage(result.code) });
          return;
        }
        setStatus({ tone: "success", text: SAVED });
        router.refresh();
      } catch (error) {
        void reportClientError(error, { action: "uploadOwnPhoto" });
        setStatus({ tone: "error", text: authMessage("INTERNAL_ERROR") });
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile photo</CardTitle>
        <CardDescription>
          {hasPhoto
            ? "The administrator uses it to confirm who you are."
            : "Required. Add a clear photo of your face so the administrator can approve your account."}{" "}
          <span lang="fil">
            {hasPhoto
              ? "Ginagamit ito ng administrator para makilala ka."
              : "Kailangan. Magdagdag ng malinaw na larawan ng iyong mukha para maaprubahan ang iyong account."}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <EmployeeAvatar name={name} photoUrl={photoUrl} size="xl" />
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              id="own-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0])}
              disabled={pending}
            />
            <Button
              type="button"
              variant={hasPhoto ? "outline" : "default"}
              className="h-11 self-start"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
            >
              {hasPhoto ? <Camera aria-hidden="true" /> : <ImageUp aria-hidden="true" />}
              {pending ? "Saving…" : hasPhoto ? "Change photo" : "Add photo"}
            </Button>
            <p className="text-muted-foreground text-sm">
              JPG, PNG or WebP, up to 5 MB. <span lang="fil">Hanggang 5 MB.</span>
            </p>
          </div>
        </div>
        <FormStatus status={status} />
      </CardContent>
    </Card>
  );
}
