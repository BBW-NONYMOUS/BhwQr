import { z } from "zod";

// Mirrors `stations` CHECKs (09-data-dictionary.md §5.4): name 2–80, latitude −90..90,
// longitude −180..180, radius NULL or 10–1000 m, kiosk_user_id must be a kiosk profile.

export const stationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  latitude: z
    .number({ error: "Enter the latitude" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ error: "Enter the longitude" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  radiusM: z
    .number({ error: "Enter a radius in metres or leave it blank" })
    .int("Use whole metres")
    .min(10, "Radius must be between 10 and 1000 m")
    .max(1000, "Radius must be between 10 and 1000 m")
    .nullable(),
  isActive: z.boolean(),
  kioskUserId: z.uuid("Choose a kiosk account").nullable(),
});
export type StationFormValues = z.infer<typeof stationFormSchema>;

/** Coordinates are stored as numeric(9,6); round so the form shows what the database keeps. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** "120 m" for a station radius, or "default (100 m)" when it inherits app_settings. */
export function radiusLabel(radiusM: number | null, defaultRadiusM: number): string {
  return radiusM === null ? `default (${defaultRadiusM} m)` : `${radiusM} m`;
}

/** OpenStreetMap link centred on the station (no map library needed). */
export function osmUrl(lat: number, lng: number, zoom = 18): string {
  const la = roundCoord(lat);
  const ln = roundCoord(lng);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=${zoom}/${la}/${ln}`;
}

/** "6.633012, 124.604871" */
export function formatCoords(lat: number, lng: number): string {
  return `${roundCoord(lat).toFixed(6)}, ${roundCoord(lng).toFixed(6)}`;
}

/** Empty input -> null, otherwise the number (NaN stays NaN so validation reports it). */
export function parseOptionalNumber(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}
