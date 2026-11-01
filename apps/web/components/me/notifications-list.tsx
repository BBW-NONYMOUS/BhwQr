"use client";

import type { Tables } from "@bhw/types";
import { BellIcon, CheckCheckIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { reportClientError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { unreadCount } from "./me-utils";

export type NotificationItem = Pick<Tables<"notifications">, "id" | "title" | "body" | "read_at" | "created_at">;

/** The employee's notifications (RLS: own rows only) with mark-as-read. */
export function NotificationsList({ userId, initial }: { userId: string; initial: NotificationItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const unread = unreadCount(items);

  async function markRead(ids: string[] | "all") {
    setBusy(ids === "all" ? "all" : (ids[0] ?? ""));
    const readAt = new Date().toISOString();
    const base = createClient().from("notifications").update({ read_at: readAt }).eq("user_id", userId);
    const { error } = await (ids === "all" ? base.is("read_at", null) : base.in("id", ids));
    setBusy(null);
    if (error) {
      toast.error("Could not mark as read. Please try again.", { description: "Subukan muli." });
      void reportClientError(new Error(error.message), { op: "notifications.mark_read", code: error.code });
      return;
    }
    setItems((prev) =>
      prev.map((n) =>
        n.read_at === null && (ids === "all" || ids.includes(n.id)) ? { ...n, read_at: readAt } : n,
      ),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="size-5 text-brand" aria-hidden />
          Notifications <span className="font-normal text-muted-foreground">· Mga abiso</span>
          {unread > 0 ? (
            <Badge className="rounded-full" aria-label={`${unread} unread`}>
              {unread}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>Approvals, correction decisions and reminders.</CardDescription>
        {unread > 0 ? (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => markRead("all")} disabled={busy !== null}>
              <CheckCheckIcon aria-hidden />
              Mark all as read
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={BellIcon} title="No notifications" description="Wala pang abiso." />
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <span
                  className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.read_at ? "font-normal" : "font-semibold")}>
                    {n.title}
                    {n.read_at ? null : <span className="sr-only"> (unread)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="pt-1 text-xs text-muted-foreground tabular-nums">{formatDateTime(n.created_at)}</p>
                </div>
                {n.read_at ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markRead([n.id])}
                    disabled={busy !== null}
                    aria-label={`Mark "${n.title}" as read`}
                  >
                    <CheckIcon aria-hidden />
                    Read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
