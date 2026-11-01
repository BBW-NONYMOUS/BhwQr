import { CheckCircle2, Circle, Clock, Hourglass, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { profileForStatusPage } from "@/components/auth/status-redirect";
import { StatusHeading, StatusShell, StatusSkeleton } from "@/components/auth/status-shell";
import { signProfilePhotos } from "@/components/employees/server-helpers";
import { ProfilePhotoCard } from "@/components/profile/profile-photo-card";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Waiting for approval",
};

type StepState = "done" | "current" | "upcoming";

const STEPS: readonly {
  state: StepState;
  en: string;
  fil: string;
  detail: string;
  detailFil: string;
}[] = [
  {
    state: "done",
    en: "Verify your email",
    fil: "I-verify ang iyong email",
    detail: "Done – your email is verified.",
    detailFil: "Tapos na – verified na ang iyong email.",
  },
  {
    state: "current",
    en: "Administrator approves and assigns your schedule",
    fil: "Aaprubahan ng administrator at itatakda ang iyong schedule",
    detail:
      "The BHW office checks your details against the barangay roster. You will get an email when it is done.",
    detailFil:
      "Susuriin ng BHW office ang iyong detalye. Makakatanggap ka ng email kapag tapos na.",
  },
  {
    state: "upcoming",
    en: "Install the mobile app",
    fil: "I-install ang mobile app",
    detail:
      "After approval, install the BHW Attendance app and log in with the same email to scan the kiosk QR.",
    detailFil:
      "Pagkatapos maaprubahan, i-install ang BHW Attendance app at mag-login gamit ang parehong email.",
  },
];

const STEP_LABEL: Record<StepState, string> = {
  done: "Completed",
  current: "In progress",
  upcoming: "Not started",
};

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <CheckCircle2 className="text-brand size-6" aria-hidden="true" />;
  if (state === "current") return <Clock className="text-foreground size-6" aria-hidden="true" />;
  return <Circle className="text-muted-foreground size-6" aria-hidden="true" />;
}

async function PendingContent() {
  const profile = await profileForStatusPage("pending");
  const photos = await signProfilePhotos(await createClient(), [profile.photo_url]);

  return (
    <div className="flex flex-col gap-8">
      <StatusHeading
        icon={<Hourglass className="size-6" aria-hidden="true" />}
        title={`Thank you, ${profile.full_name}. Your registration is waiting for approval.`}
        fil="Salamat! Hinihintay pa ang pag-apruba ng iyong rehistro."
      />
      <p className="text-muted-foreground text-sm">
        Submitted on {formatDate(profile.created_at)}
        {profile.bhw_id_number ? ` · BHW ID ${profile.bhw_id_number}` : ""}
        {profile.area ? ` · ${profile.area}` : ""}
      </p>

      <ProfilePhotoCard
        name={profile.full_name}
        photoUrl={profile.photo_url ? (photos.get(profile.photo_url) ?? null) : null}
        hasPhoto={Boolean(profile.photo_url)}
      />

      <ol className="flex flex-col" aria-label="Registration steps">
        {STEPS.map((step, index) => (
          <li
            key={step.en}
            className="relative flex gap-4 pb-6 last:pb-0"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {index < STEPS.length - 1 ? (
              <span className="bg-border absolute top-8 bottom-1 left-3 w-px" aria-hidden="true" />
            ) : null}
            <StepIcon state={step.state} />
            <div className="flex flex-1 flex-col gap-1">
              <p
                className={cn("font-medium", step.state === "upcoming" && "text-muted-foreground")}
              >
                <span className="sr-only">
                  Step {index + 1}, {STEP_LABEL[step.state]}:{" "}
                </span>
                {step.en}
              </p>
              <p lang="fil" className="text-muted-foreground text-sm">
                {step.fil}
              </p>
              <p className="text-sm">{step.detail}</p>
              <p lang="fil" className="text-muted-foreground text-sm">
                {step.detailFil}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-muted flex gap-3 rounded-lg p-4 text-sm">
        <Smartphone className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          You cannot scan attendance until your account is approved. If it takes more than 3 working
          days, please visit the BHW office.{" "}
          <span lang="fil" className="text-muted-foreground">
            Hindi ka pa makakapag-scan hangga&apos;t hindi naaaprubahan ang iyong account. Kung
            lumampas ng 3 araw ng trabaho, pumunta po sa BHW office.
          </span>
        </p>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <StatusShell>
      <Suspense fallback={<StatusSkeleton />}>
        <PendingContent />
      </Suspense>
    </StatusShell>
  );
}
