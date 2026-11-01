import { CircleX, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { profileForStatusPage } from "@/components/auth/status-redirect";
import { StatusHeading, StatusShell, StatusSkeleton } from "@/components/auth/status-shell";

export const metadata: Metadata = {
  title: "Registration not approved",
};

async function RejectedContent() {
  const profile = await profileForStatusPage("rejected");

  return (
    <div className="flex flex-col gap-8">
      <StatusHeading
        tone="destructive"
        icon={<CircleX className="size-6" aria-hidden="true" />}
        title="Your registration was not approved"
        fil="Hindi naaprubahan ang iyong rehistro"
      />

      <section
        aria-labelledby="rejection-reason-title"
        className="flex flex-col gap-2 rounded-lg border p-4"
      >
        <h2 id="rejection-reason-title" className="flex items-center gap-2 text-sm font-medium">
          <MessageSquareText className="text-muted-foreground size-4" aria-hidden="true" />
          Reason from the administrator{" "}
          <span lang="fil" className="text-muted-foreground font-normal">
            · Dahilan
          </span>
        </h2>
        <p className="text-base whitespace-pre-line">
          {profile.rejection_reason?.trim() || "No reason was recorded. Please ask the BHW office."}
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">What you can do</h2>
        <ul className="flex list-disc flex-col gap-3 pl-5 text-sm">
          <li>
            If you think this is a mistake, visit the BHW office at the Barangay Hall, Kalawag II
            and bring your BHW ID.
            <span lang="fil" className="text-muted-foreground block">
              Kung sa tingin mo ay may mali, pumunta sa BHW office sa Barangay Hall at dalhin ang
              iyong BHW ID.
            </span>
          </li>
          <li>
            To register again with corrected details, ask the administrator to remove this
            registration first. Otherwise it is deleted automatically 90 days after rejection.
            <span lang="fil" className="text-muted-foreground block">
              Para magrehistro muli, hilingin sa administrator na burahin muna ang rehistrong ito.
              Kung hindi, kusa itong mabubura 90 araw matapos ma-reject.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function RejectedPage() {
  return (
    <StatusShell>
      <Suspense fallback={<StatusSkeleton />}>
        <RejectedContent />
      </Suspense>
    </StatusShell>
  );
}
