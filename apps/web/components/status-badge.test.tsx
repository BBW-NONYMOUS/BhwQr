import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { statusColors, type AttendanceStatusToken } from "@bhw/design-tokens";

import { StatusBadge } from "./status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it.each(Object.keys(statusColors) as AttendanceStatusToken[])(
    "renders %s with its label and token classes",
    (status) => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByText(statusColors[status].label);
      const slug = status.replace("_", "-");
      expect(badge.className).toContain(`bg-status-${slug}`);
      expect(badge.className).toContain(`text-status-${slug}-foreground`);
      expect(badge.className).toContain("rounded-full");
      expect(badge.getAttribute("data-status")).toBe(status);
    },
  );

  it("renders the Filipino label on request", () => {
    render(<StatusBadge status="late" filipino />);
    expect(screen.getByText("Huli")).toBeTruthy();
  });
});
