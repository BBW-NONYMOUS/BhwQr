"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon, LocateFixedIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/actions";

import { applyFieldErrors, numberInputValue } from "./form-utils";
import { osmUrl, parseOptionalNumber, roundCoord, stationFormSchema, type StationFormValues } from "./station";

export type SaveStationAction = (input: {
  id: string | null;
  values: StationFormValues;
}) => Promise<ActionResult<{ id: string }>>;

export interface KioskAccount {
  id: string;
  name: string;
  email: string | null;
  /** Station currently linked to this account (other than the one being edited). */
  linkedStation: string | null;
}

const FIELDS = ["name", "latitude", "longitude", "radiusM", "isActive", "kioskUserId"] as const;
const NO_KIOSK = "none";

const EMPTY: StationFormValues = {
  name: "",
  latitude: Number.NaN,
  longitude: Number.NaN,
  radiusM: null,
  isActive: true,
  kioskUserId: null,
};

interface StationFormDialogProps {
  action: SaveStationAction;
  station?: { id: string; values: StationFormValues };
  kioskAccounts: KioskAccount[];
  defaultRadiusM: number;
  trigger: ReactNode;
}

export function StationFormDialog({ action, station, kioskAccounts, defaultRadiusM, trigger }: StationFormDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{station ? "Edit station" : "New station"}</DialogTitle>
          <DialogDescription>
            Where the kiosk stands. Phones must be inside the geofence around these coordinates to record attendance.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <StationForm
            action={action}
            station={station}
            kioskAccounts={kioskAccounts}
            defaultRadiusM={defaultRadiusM}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StationForm({
  action,
  station,
  kioskAccounts,
  defaultRadiusM,
  onDone,
}: Omit<StationFormDialogProps, "trigger"> & { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const form = useForm<StationFormValues>({
    resolver: zodResolver(stationFormSchema),
    defaultValues: station?.values ?? EMPTY,
    mode: "onTouched",
  });
  const [lat, lng] = useWatch({ control: form.control, name: ["latitude", "longitude"] });
  const coordsValid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const fillFromMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("This browser cannot read your location. Enter the coordinates instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        form.setValue("latitude", roundCoord(pos.coords.latitude), { shouldValidate: true, shouldDirty: true });
        form.setValue("longitude", roundCoord(pos.coords.longitude), { shouldValidate: true, shouldDirty: true });
        setLocationNote(
          `Filled from this device (accuracy about ${Math.round(pos.coords.accuracy)} m). Stand next to the kiosk for the best result.`,
        );
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow location for this site or enter the coordinates."
            : "Your location could not be read. Try again near a window or enter the coordinates.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const onSubmit = (values: StationFormValues) =>
    startTransition(async () => {
      const result = await action({ id: station?.id ?? null, values });
      if (!result.ok) {
        applyFieldErrors(form.setError, result, FIELDS);
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Station saved.");
      onDone();
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="station-name">Name</FieldLabel>
              <Input
                {...field}
                id="station-name"
                placeholder="BHW Office – Main Entrance"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["latitude", "longitude"] as const).map((name) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`station-${name}`}>{name === "latitude" ? "Latitude" : "Longitude"}</FieldLabel>
                    <Input
                      id={`station-${name}`}
                      name={field.name}
                      ref={field.ref}
                      type="number"
                      inputMode="decimal"
                      step="0.000001"
                      placeholder={name === "latitude" ? "6.633012" : "124.604871"}
                      value={numberInputValue(field.value)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                      className="tabular-nums"
                    />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fillFromMyLocation} disabled={locating}>
              <LocateFixedIcon data-icon="inline-start" aria-hidden />
              {locating ? "Reading location…" : "Use my location"}
            </Button>
            {coordsValid ? (
              <Button asChild variant="link" size="sm">
                <a href={osmUrl(lat, lng)} target="_blank" rel="noopener noreferrer">
                  Check on OpenStreetMap
                  <ExternalLinkIcon data-icon="inline-end" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
            ) : null}
          </div>
          {locationNote ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {locationNote}
            </p>
          ) : null}
        </div>

        <Controller
          name="radiusM"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="station-radius">Geofence radius (m, optional)</FieldLabel>
              <Input
                id="station-radius"
                name={field.name}
                ref={field.ref}
                type="number"
                inputMode="numeric"
                min={10}
                max={1000}
                step={1}
                placeholder={`Default: ${defaultRadiusM}`}
                value={numberInputValue(field.value)}
                onChange={(e) => field.onChange(parseOptionalNumber(e.target.value))}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
                className="tabular-nums sm:max-w-[50%]"
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>
                  10–1000 m. Leave blank to use the default from Settings (currently {defaultRadiusM} m).
                </FieldDescription>
              )}
            </Field>
          )}
        />

        <Controller
          name="kioskUserId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="station-kiosk">Kiosk account</FieldLabel>
              <Select
                value={field.value ?? NO_KIOSK}
                onValueChange={(v) => field.onChange(v === NO_KIOSK ? null : v)}
              >
                <SelectTrigger id="station-kiosk" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
                  <SelectValue placeholder="Choose a kiosk account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_KIOSK}>No kiosk account</SelectItem>
                  {kioskAccounts.map((k) => (
                    <SelectItem key={k.id} value={k.id} disabled={k.linkedStation !== null}>
                      {k.name}
                      {k.email ? ` · ${k.email}` : ""}
                      {k.linkedStation ? ` (linked to ${k.linkedStation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>
                  {kioskAccounts.length === 0
                    ? "No kiosk accounts exist yet. Create a staff account with the kiosk role from Employees first."
                    : "The account signed in on the kiosk tablet. One kiosk account per station."}
                </FieldDescription>
              )}
            </Field>
          )}
        />

        <Controller
          name="isActive"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="station-active">Active</FieldLabel>
                <FieldDescription>
                  Inactive stations stop issuing QR codes and scans return “station inactive”.
                </FieldDescription>
              </FieldContent>
              <Switch id="station-active" checked={field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      </FieldGroup>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : station ? "Save changes" : "Create station"}
        </Button>
      </DialogFooter>
    </form>
  );
}
