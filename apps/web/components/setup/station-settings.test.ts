import { describe, expect, it } from "vitest";

import { mapConstraintError } from "./db-errors";
import { SETTINGS_DEFAULTS, SETTINGS_SECTIONS, changedSettingKeys, settingsFormSchema } from "./settings";
import { formatCoords, osmUrl, parseOptionalNumber, radiusLabel, roundCoord, stationFormSchema } from "./station";

const station = {
  name: "BHW Office – Main Entrance",
  latitude: 6.633012,
  longitude: 124.604871,
  radiusM: null,
  isActive: true,
  kioskUserId: null,
};

describe("stationFormSchema", () => {
  it("accepts a station using the default radius", () => {
    expect(stationFormSchema.safeParse(station).success).toBe(true);
  });

  it("enforces coordinate and radius ranges", () => {
    expect(stationFormSchema.safeParse({ ...station, latitude: 91 }).success).toBe(false);
    expect(stationFormSchema.safeParse({ ...station, longitude: -181 }).success).toBe(false);
    expect(stationFormSchema.safeParse({ ...station, radiusM: 9 }).success).toBe(false);
    expect(stationFormSchema.safeParse({ ...station, radiusM: 1001 }).success).toBe(false);
    expect(stationFormSchema.safeParse({ ...station, radiusM: 150 }).success).toBe(true);
    expect(stationFormSchema.safeParse({ ...station, latitude: Number.NaN }).success).toBe(false);
  });

  it("requires a uuid kiosk account when one is set", () => {
    expect(stationFormSchema.safeParse({ ...station, kioskUserId: "kiosk" }).success).toBe(false);
    expect(
      stationFormSchema.safeParse({ ...station, kioskUserId: "c2d8f5a1-7e90-4b36-9d1c-0a5e6f3b8d27" }).success,
    ).toBe(true);
  });
});

describe("station helpers", () => {
  it("labels own and default radius", () => {
    expect(radiusLabel(null, 100)).toBe("default (100 m)");
    expect(radiusLabel(250, 100)).toBe("250 m");
  });

  it("rounds to numeric(9,6) and builds an OpenStreetMap link", () => {
    expect(roundCoord(6.6330124999)).toBe(6.633012);
    expect(formatCoords(6.63, 124.6)).toBe("6.630000, 124.600000");
    expect(osmUrl(6.633012, 124.604871)).toBe(
      "https://www.openstreetmap.org/?mlat=6.633012&mlon=124.604871#map=18/6.633012/124.604871",
    );
  });

  it("parses optional numeric inputs", () => {
    expect(parseOptionalNumber("")).toBeNull();
    expect(parseOptionalNumber("  ")).toBeNull();
    expect(parseOptionalNumber("120")).toBe(120);
    expect(Number.isNaN(parseOptionalNumber("abc"))).toBe(true);
  });
});

describe("settingsFormSchema", () => {
  it("accepts the documented defaults", () => {
    expect(settingsFormSchema.safeParse(SETTINGS_DEFAULTS).success).toBe(true);
  });

  it("requires refresh < lifetime", () => {
    const r = settingsFormSchema.safeParse({ ...SETTINGS_DEFAULTS, token_lifetime_seconds: 20, token_refresh_seconds: 20 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["token_refresh_seconds"]);
  });

  it("rejects every numeric field just outside its range (metadata matches schema)", () => {
    const fields = SETTINGS_SECTIONS.flatMap((s) => s.numbers);
    expect(fields).toHaveLength(9);
    for (const f of fields) {
      // Keep refresh < lifetime valid while probing the edges of each field.
      const base = { ...SETTINGS_DEFAULTS, token_lifetime_seconds: 120, token_refresh_seconds: 5 };
      expect(settingsFormSchema.safeParse({ ...base, [f.key]: f.min }).success, `${f.key} min`).toBe(true);
      expect(settingsFormSchema.safeParse({ ...base, [f.key]: f.min - 1 }).success, `${f.key} min-1`).toBe(false);
      expect(settingsFormSchema.safeParse({ ...base, [f.key]: f.max + 1 }).success, `${f.key} max+1`).toBe(false);
    }
  });

  it("reports changed keys", () => {
    expect(changedSettingKeys(SETTINGS_DEFAULTS, { ...SETTINGS_DEFAULTS, cooldown_minutes: 10 })).toEqual([
      "cooldown_minutes",
    ]);
  });
});

describe("mapConstraintError", () => {
  const messages = [{ match: "stations_name_key", field: "name", message: "Name taken" }];

  it("maps a known unique violation to a field error", () => {
    const r = mapConstraintError(
      { code: "23505", message: 'duplicate key value violates unique constraint "stations_name_key"' },
      messages,
    );
    expect(r).toMatchObject({ ok: false, fieldErrors: { name: "Name taken" } });
  });

  it("falls back to the catalog for SQL-raised codes", () => {
    const r = mapConstraintError({ code: "P0001", message: "SCHEDULE_IN_USE" }, messages);
    expect(r).toMatchObject({ ok: false, code: "SCHEDULE_IN_USE" });
  });
});
