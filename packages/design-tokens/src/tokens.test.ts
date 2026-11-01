import { test } from "node:test";
import assert from "node:assert/strict";
import { colors, statusColors, radius, touchTarget } from "./tokens.ts";
import { paperTheme } from "./paper.ts";

test("light palette matches the visual reference", () => {
  assert.equal(colors.light.background, "#ffffff");
  assert.equal(colors.light.foreground, "#09090b");
  assert.equal(colors.light.mutedForeground, "#71717a");
  assert.equal(colors.light.border, "#e4e4e7");
  assert.equal(colors.light.primary, "#18181b");
  assert.equal(colors.light.brand, "#0f766e");
});

test("status badges match the visual reference", () => {
  assert.deepEqual([statusColors.on_time.bg, statusColors.on_time.fg], ["#dcfce7", "#166534"]);
  assert.deepEqual([statusColors.late.bg, statusColors.late.fg], ["#fef3c7", "#92400e"]);
  assert.deepEqual([statusColors.absent.bg, statusColors.absent.fg], ["#fee2e2", "#991b1b"]);
  assert.deepEqual(
    [statusColors.incomplete.bg, statusColors.incomplete.fg],
    ["#f4f4f5", "#3f3f46"],
  );
});

test("radius and touch target", () => {
  assert.equal(radius.control, 6);
  assert.equal(radius.cardWeb, 12);
  assert.equal(radius.cardMobile, 16);
  assert.ok(touchTarget >= 44);
});

test("paper theme uses brand as primary", () => {
  assert.equal(paperTheme("light").colors.primary, "#0f766e");
  assert.equal(paperTheme("dark").dark, true);
});
