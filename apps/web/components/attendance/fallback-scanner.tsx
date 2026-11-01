"use client";

import { errorMessage } from "@bhw/types";
import type { IDetectedBarcode, IScannerError } from "@yudiel/react-qr-scanner";
import {
  CameraOffIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClipboardPenIcon,
  KeyboardIcon,
  LoaderCircleIcon,
  ScanLineIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { recordFallbackScanAction, type FallbackScanResult } from "@/app/admin/fallback-scan/actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { reportClientError } from "@/lib/report-error";
import { cn } from "@/lib/utils";

import { ManualEntryDialog, type EmployeeOption, type StationOption } from "./manual-entry-dialog";
import { createScanGate, isPersonalQrContent, MAX_QR_LENGTH } from "./scan-gate";

// The scanner touches camera and BarcodeDetector APIs, so it only loads in the browser.
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <Skeleton className="size-full" aria-label="Starting camera" />,
});

/** How long a result stays on screen before the panel is ready for the next person. */
const RESULT_MS = 5000;

type ShownResult = FallbackScanResult & { key: number };

function cameraMessage(error: IScannerError): { en: string; fil: string } {
  if (error.kind === "permission-denied") {
    return { en: errorMessage("CAMERA_DENIED", "en"), fil: errorMessage("CAMERA_DENIED", "fil") };
  }
  if (error.kind === "insecure-context") {
    return {
      en: "The camera only works on a secure (https) connection.",
      fil: "Gumagana lang ang camera sa secure (https) na koneksyon.",
    };
  }
  if (error.kind === "no-camera") {
    return { en: "No camera was found on this computer.", fil: "Walang camera na nakita sa computer na ito." };
  }
  if (error.kind === "in-use") {
    return {
      en: "The camera is being used by another app. Close it and reload this page.",
      fil: "Ginagamit ng ibang app ang camera. Isara ito at i-reload ang pahina.",
    };
  }
  return {
    en: "The camera could not be started.",
    fil: "Hindi mabuksan ang camera.",
  };
}

/**
 * Fallback Scan (core flow 5, FR-63..FR-67): the admin scans an employee's rotating personal
 * QR with this computer's camera, or pastes its content when the camera is unavailable.
 */
export function FallbackScanner({
  stations,
  employees,
  today,
}: {
  stations: StationOption[];
  employees: EmployeeOption[];
  today: string;
}) {
  const [stationId, setStationId] = useState<string | null>(stations.length === 1 ? (stations[0]?.id ?? null) : null);
  const [result, setResult] = useState<ShownResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<IScannerError | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKey, setManualKey] = useState(0);
  const [busy, startTransition] = useTransition();
  const [gate] = useState(() => createScanGate());
  const inFlight = useRef(false);

  // Clear the result panel after 5 s so the next employee sees a ready screen.
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [hint]);

  function submit(content: string) {
    if (!stationId) {
      setHint("Choose the station first, then scan again.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setHint(null);
    startTransition(async () => {
      try {
        const res = await recordFallbackScanAction({ token: content, stationId });
        setResult({ ...res, key: Date.now() });
      } catch (e) {
        void reportClientError(e, { feature: "fallback-scan", step: "submit" });
        setResult({
          ok: false,
          code: "INTERNAL_ERROR",
          message: errorMessage("INTERNAL_ERROR", "en"),
          params: {},
          key: Date.now(),
        });
      } finally {
        inFlight.current = false;
      }
    });
  }

  function onScan(codes: IDetectedBarcode[]) {
    const now = Date.now();
    for (const code of codes) {
      const decision = gate.check(code.rawValue, now);
      if (decision === "accept") {
        submit(code.rawValue);
        return;
      }
      if (decision === "not_personal_qr") {
        setHint("That is not a personal attendance QR. Ask the employee to open My QR in the BHW app.");
      }
    }
  }

  function onCameraError(error: IScannerError) {
    setCameraError(error);
    setShowPaste(true);
    void reportClientError(
      new Error(`Fallback scan camera error (${error.kind}): ${error.message}`),
      { feature: "fallback-scan", kind: error.kind },
      "web",
      error.kind === "permission-denied" ? "warning" : "error",
    );
  }

  function onPasteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = pasted.trim();
    if (!isPersonalQrContent(content)) {
      setPasteError('Paste the full personal QR content. It starts with "BHWPQR1:".');
      return;
    }
    setPasteError(null);
    submit(content);
    setPasted("");
  }

  function onStationChange(id: string) {
    setStationId(id);
    gate.reset();
    setHint(null);
  }

  const cameraMsg = cameraError ? cameraMessage(cameraError) : null;
  const stationName = stations.find((s) => s.id === stationId)?.name;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="fb-station">Station</FieldLabel>
          <Select value={stationId ?? ""} onValueChange={onStationChange}>
            <SelectTrigger id="fb-station" className="w-full data-[size=default]:h-11 sm:max-w-sm">
              <SelectValue placeholder="Choose the station where the employee is" />
            </SelectTrigger>
            <SelectContent>
              {stations.map((s) => (
                <SelectItem key={s.id} value={s.id} className="min-h-11">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>The attendance record is saved for this station with you as the recorder.</FieldDescription>
        </Field>

        <div className="relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-xl border bg-muted">
          {cameraError ? (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
              <CameraOffIcon className="size-10 text-muted-foreground" aria-hidden />
              <p className="font-medium">{cameraMsg?.en}</p>
              <p className="text-sm text-muted-foreground italic" lang="fil">
                {cameraMsg?.fil}
              </p>
              <Button variant="outline" className="h-11" onClick={() => setCameraError(null)}>
                Try the camera again
              </Button>
            </div>
          ) : (
            <Scanner
              onScan={onScan}
              onError={onCameraError}
              formats={["qr_code"]}
              paused={!stationId}
              allowMultiple={false}
              sound={false}
              components={{ finder: true, torch: true }}
              constraints={{ facingMode: "environment" }}
              classNames={{ container: "size-full", video: "size-full object-cover" }}
            />
          )}
          {!stationId && !cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6 text-center">
              <p className="font-medium">Choose the station above to start scanning.</p>
            </div>
          ) : null}
          {busy ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/90 p-3 text-sm font-medium">
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              Checking QR…
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setShowPaste((v) => !v)}
            aria-expanded={showPaste}
            aria-controls="fb-paste"
          >
            <KeyboardIcon data-icon="inline-start" aria-hidden />
            {showPaste ? "Hide paste box" : "Paste QR content instead"}
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setManualKey((k) => k + 1);
              setManualOpen(true);
            }}
          >
            <ClipboardPenIcon data-icon="inline-start" aria-hidden />
            Manual entry instead
          </Button>
        </div>

        {showPaste ? (
          <form id="fb-paste" onSubmit={onPasteSubmit} className="space-y-3 rounded-xl border p-4" noValidate>
            <Field data-invalid={pasteError !== null}>
              <FieldLabel htmlFor="fb-paste-text">Personal QR content</FieldLabel>
              <Textarea
                id="fb-paste-text"
                rows={3}
                value={pasted}
                maxLength={MAX_QR_LENGTH}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="BHWPQR1:…"
                className="font-mono text-xs"
                aria-invalid={pasteError !== null}
                aria-describedby="fb-paste-help"
                autoComplete="off"
                spellCheck={false}
              />
              <FieldDescription id="fb-paste-help">
                Use a QR reader app or the scanner&apos;s text output, then paste the whole text here.
              </FieldDescription>
              {pasteError ? (
                <p role="alert" className="text-sm text-destructive">
                  {pasteError}
                </p>
              ) : null}
            </Field>
            <Button type="submit" className="h-11" disabled={busy || pasted.trim() === "" || !stationId}>
              <ScanLineIcon data-icon="inline-start" aria-hidden />
              Record attendance
            </Button>
          </form>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Result</h2>
        <div
          aria-live="assertive"
          aria-atomic="true"
          className={cn(
            "flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 text-center transition-colors",
            !result && "border-dashed",
            result?.ok && "border-primary bg-primary/10",
            result && !result.ok && "border-destructive bg-destructive/10",
          )}
        >
          {result?.ok ? (
            <>
              <CircleCheckIcon className="size-14 text-primary" aria-hidden />
              <p className="text-3xl font-semibold tracking-tight">{result.data.employeeName}</p>
              <p className="text-xl">
                {result.data.action === "time_in" ? "Time-in" : "Time-out"} recorded at{" "}
                <span className="font-semibold tabular-nums">{result.data.time}</span>
              </p>
              <StatusBadge status={result.data.status} className="px-3 py-1 text-sm" />
              {result.data.stationName ? (
                <p className="text-sm text-muted-foreground">{result.data.stationName}</p>
              ) : null}
            </>
          ) : result ? (
            <>
              <CircleXIcon className="size-14 text-destructive" aria-hidden />
              <p className="text-xl font-semibold">{errorMessage(result.code, "en", result.params)}</p>
              <p className="text-base text-muted-foreground italic" lang="fil">
                {errorMessage(result.code, "fil", result.params)}
              </p>
            </>
          ) : hint ? (
            <p className="text-base font-medium">{hint}</p>
          ) : null}
        </div>
        {!result && !hint ? (
          <p className="text-sm text-muted-foreground">
            {stationId
              ? `Ready. Ask the employee to open My QR in the BHW app and hold it in front of the camera (${stationName}).`
              : "Choose a station to begin."}
          </p>
        ) : null}

        <Alert>
          <ScanLineIcon />
          <AlertTitle>When to use this page</AlertTitle>
          <AlertDescription>
            Use it when an employee cannot scan the kiosk (kiosk offline, phone camera or GPS problem). The record
            is marked &ldquo;Fallback (personal QR)&rdquo; and saved in the Audit Log. If the employee cannot show a
            personal QR, use Manual entry with a reason.
          </AlertDescription>
        </Alert>
      </div>

      <ManualEntryDialog
        key={manualKey}
        open={manualOpen}
        onOpenChange={setManualOpen}
        employees={employees}
        stations={stations}
        today={today}
        initial={{ stationId }}
      />
    </div>
  );
}
