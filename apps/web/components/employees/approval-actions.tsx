"use client";

import { CheckIcon, XIcon } from "lucide-react";

import { rejectRegistration } from "@/app/admin/approvals/actions";
import { Button } from "@/components/ui/button";

import { ReasonDialog } from "./reason-dialog";
import { ScheduleDialog, type ScheduleOption } from "./schedule-dialog";

/**
 * Approve / Reject buttons on a pending registration card (FR-22, FR-23). Approve stays disabled
 * until the registrant has a profile photo (BR-12a; approve_employee also refuses PHOTO_REQUIRED).
 */
export function ApprovalActions({
  employeeId,
  employeeName,
  schedules,
  today,
  hasPhoto,
}: {
  employeeId: string;
  employeeName: string;
  schedules: ScheduleOption[];
  today: string;
  hasPhoto: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      <ReasonDialog
        title={`Reject ${employeeName}?`}
        description="The registrant sees this reason on the Rejected screen, in the app and by e-mail. Rejected registrations are deleted after 90 days."
        reasonLabel="Reason for rejection"
        reasonHint="At least 10 characters, e.g. “BHW ID number not found in the barangay roster.”"
        confirmLabel="Reject registration"
        destructive
        onConfirm={(input) => rejectRegistration(employeeId, input)}
        trigger={
          <Button variant="outline" className="h-11" aria-label={`Reject ${employeeName}`}>
            <XIcon data-icon="inline-start" aria-hidden />
            Reject
          </Button>
        }
      />
      {hasPhoto ? (
        <ScheduleDialog
          purpose="approve"
          employeeId={employeeId}
          employeeName={employeeName}
          schedules={schedules}
          defaultEffectiveFrom={today}
          trigger={
            <Button className="h-11" aria-label={`Approve ${employeeName}`}>
              <CheckIcon data-icon="inline-start" aria-hidden />
              Approve
            </Button>
          }
        />
      ) : (
        <Button className="h-11" disabled aria-describedby={`no-photo-${employeeId}`}>
          <CheckIcon data-icon="inline-start" aria-hidden />
          Approve
        </Button>
      )}
      {hasPhoto ? null : (
        <p id={`no-photo-${employeeId}`} className="text-muted-foreground col-span-2 text-sm">
          Waiting for a profile photo. The registrant adds it on their &ldquo;waiting for
          approval&rdquo; page. <span lang="fil">Hinihintay ang profile photo.</span>
        </p>
      )}
    </div>
  );
}
