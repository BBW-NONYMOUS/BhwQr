import { CORRECTION_TYPE_LABELS, type Tables } from "@bhw/types";
import { FilePenLineIcon } from "lucide-react";

import { EmptyState } from "@/components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";

import { CorrectionStatusBadge } from "./correction-status-badge";

export type RequestItem = Pick<
  Tables<"correction_requests">,
  "id" | "type" | "work_date" | "status" | "remarks" | "created_at"
>;

/** My Requests: the employee's own correction requests (filing and cancelling is in the app). */
export function RequestsList({ items }: { items: RequestItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePenLineIcon className="size-5 text-brand" aria-hidden />
          My Requests <span className="font-normal text-muted-foreground">· Aking mga kahilingan</span>
        </CardTitle>
        <CardDescription>Correction requests you filed in the mobile app and their review status.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={FilePenLineIcon}
            title="No correction requests"
            description="File a correction in the BHW Attendance app if a time-in or time-out is missing or wrong."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date · Petsa</TableHead>
                  <TableHead>Type · Uri</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.work_date)}</TableCell>
                    <TableCell>
                      {CORRECTION_TYPE_LABELS[r.type].en}
                      <span className="block text-xs text-muted-foreground">
                        {CORRECTION_TYPE_LABELS[r.type].fil}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      <CorrectionStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="max-w-xs text-sm whitespace-normal text-muted-foreground">
                      {r.remarks ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
