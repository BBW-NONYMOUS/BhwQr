import { AlertTriangleIcon, MonitorIcon, ShieldAlertIcon, WifiOffIcon } from "lucide-react";

import { EmptyState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { HealthBadge } from "./badges";
import {
  bucketHeartbeats,
  driftLevel,
  formatDrift,
  formatRelative,
  SCAN_ERROR_LABELS,
  type FailureGroup,
  type StationHealth,
} from "./health";
import { HeartbeatSparkline } from "./heartbeat-sparkline";

export interface StationHealthCard {
  id: string;
  name: string;
  health: StationHealth;
  lastSeenAt: string | null;
  appVersion: string | null;
  clockDriftMs: number | null;
  lastTokenAt: string | null;
  /** Heartbeat timestamps of the last hour. */
  recentBeats: string[];
}

export interface AnomalyRow {
  id: string;
  createdAt: string;
  employeeName: string | null;
  message: string;
  lastCode: string | null;
  failures10min: number | null;
  mockedLocation: boolean;
}

/** Offline alert (AC-10): a kiosk that stops sending heartbeats is called out at the top. */
export function OfflineBanner({ stations, nowMs }: { stations: StationHealthCard[]; nowMs: number }) {
  const offline = stations.filter((s) => s.health === "offline" || s.health === "never");
  if (offline.length === 0) return null;
  return (
    <Alert variant="destructive" role="alert">
      <WifiOffIcon aria-hidden />
      <AlertTitle>
        {offline.length === 1 ? "1 kiosk is offline" : `${offline.length} kiosks are offline`}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-inside list-disc">
          {offline.map((s) => (
            <li key={s.id}>
              {s.name} — {s.lastSeenAt ? `last heartbeat ${formatRelative(s.lastSeenAt, nowMs)}` : "has never connected"}
            </li>
          ))}
        </ul>
        <p className="mt-1">
          Check that the kiosk tablet is on, connected to the internet and signed in. Employees can still be recorded
          with Fallback Scan.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function StationCards({
  stations,
  nowMs,
  heartbeatIntervalSeconds,
}: {
  stations: StationHealthCard[];
  nowMs: number;
  heartbeatIntervalSeconds: number;
}) {
  if (stations.length === 0) {
    return (
      <EmptyState
        icon={MonitorIcon}
        title="No active stations"
        description="Add a station under Stations & Kiosks to start monitoring its kiosk."
      />
    );
  }
  const expectedPerBucket = 300 / heartbeatIntervalSeconds;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {stations.map((s) => {
        const drift = driftLevel(s.clockDriftMs);
        return (
          <Card key={s.id} data-health={s.health}>
            <CardHeader>
              <CardTitle className="truncate">{s.name}</CardTitle>
              <CardDescription>
                {s.lastSeenAt ? (
                  <>
                    Last seen{" "}
                    <time dateTime={s.lastSeenAt} title={formatDateTime(s.lastSeenAt)}>
                      {formatRelative(s.lastSeenAt, nowMs)}
                    </time>
                  </>
                ) : (
                  "No heartbeat received yet"
                )}
              </CardDescription>
              <CardAction>
                <HealthBadge health={s.health} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">App version</dt>
                  <dd className="font-medium tabular-nums">{s.appVersion ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Clock drift</dt>
                  <dd
                    className={cn(
                      "inline-flex items-center gap-1 font-medium tabular-nums",
                      drift === "warning" && "text-destructive",
                    )}
                  >
                    {drift === "warning" ? <AlertTriangleIcon className="size-3.5" aria-hidden /> : null}
                    {s.clockDriftMs === null ? "—" : formatDrift(s.clockDriftMs)}
                    {drift === "warning" ? <span className="sr-only">(more than 30 seconds)</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last QR token</dt>
                  <dd className="font-medium tabular-nums">
                    {s.lastTokenAt ? (
                      <time dateTime={s.lastTokenAt} title={formatDateTime(s.lastTokenAt)}>
                        {formatTime(s.lastTokenAt)} ({formatRelative(s.lastTokenAt, nowMs)})
                      </time>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Interval</dt>
                  <dd className="font-medium tabular-nums">every {heartbeatIntervalSeconds} s</dd>
                </div>
              </dl>
              <HeartbeatSparkline
                points={bucketHeartbeats(s.recentBeats, nowMs)}
                expectedPerBucket={expectedPerBucket}
              />
              {drift === "warning" ? (
                <p className="text-xs text-destructive">
                  The kiosk clock is off by more than 30 s. Attendance uses server time, but set the tablet to automatic
                  date and time.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ScanHealthTable({ groups, total }: { groups: FailureGroup[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Failed scans, last 24 hours</CardTitle>
        <CardDescription>
          {total === 0 ? "No failed scans." : `${total} failed scan${total === 1 ? "" : "s"}, grouped by reason.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <EmptyState title="All scans went through" description="No scan was rejected in the last 24 hours." />
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>Latest detail</TableHead>
                  <TableHead>Latest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.code}>
                    <TableCell className="align-top">
                      <code className="font-mono text-xs">{g.code}</code>
                      <p className="max-w-xs text-xs whitespace-normal text-muted-foreground">
                        {SCAN_ERROR_LABELS[g.code] ?? "Other scan error"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right align-top font-medium tabular-nums">{g.count}</TableCell>
                    <TableCell className="max-w-sm align-top whitespace-normal">{g.latestReason ?? "—"}</TableCell>
                    <TableCell className="align-top tabular-nums">{formatDateTime(g.latestAt)}</TableCell>
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

export function AnomalyTable({ rows }: { rows: AnomalyRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly flags, last 7 days</CardTitle>
        <CardDescription>
          Suspicious scan patterns: mock GPS, 5+ failures in 10 minutes, or repeated geofence / reused-QR failures.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={ShieldAlertIcon} title="No anomalies flagged" description="Nothing suspicious in the last 7 days." />
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">Failures (10 min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell className="font-medium">{r.employeeName ?? "Unknown employee"}</TableCell>
                    <TableCell className="whitespace-normal">
                      {r.mockedLocation ? "Mock location detected" : r.message}
                      {r.lastCode ? (
                        <span className="block text-xs text-muted-foreground">
                          Last code <code className="font-mono">{r.lastCode}</code>
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.failures10min ?? "—"}</TableCell>
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
