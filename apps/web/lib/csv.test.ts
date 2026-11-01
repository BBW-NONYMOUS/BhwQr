import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas and quotes, keeps ñ, and neutralises formulas", () => {
    const csv = toCsv(
      [{ name: 'Peña, "Bing"', note: "=HYPERLINK(1)" }],
      [
        { header: "Name", value: (r) => r.name },
        { header: "Note", value: (r) => r.note },
      ],
    );
    expect(csv.startsWith("﻿Name,Note\r\n")).toBe(true);
    expect(csv).toContain('"Peña, ""Bing"""');
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
