import { describe, expect, it } from "vitest";

import { bucketHeartbeats, classifyStation, driftLevel, formatDrift, formatRelative, groupFailures } from "./health";

const NOW = Date.parse("2026-11-01T08:00:00+08:00");
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

describe("classifyStation", () => {
  it("is online when flagged and seen within 3 intervals", () => {
    expect(classifyStation({ is_active: true, is_online: true, last_seen_at: ago(170) }, NOW, 60)).toBe("online");
  });

  it("is offline once 3 heartbeats are missed, even before the job flips the flag", () => {
    expect(classifyStation({ is_active: true, is_online: true, last_seen_at: ago(181) }, NOW, 60)).toBe("offline");
    expect(classifyStation({ is_active: true, is_online: false, last_seen_at: ago(10) }, NOW, 60)).toBe("offline");
  });

  it("uses the configured interval", () => {
    expect(classifyStation({ is_active: true, is_online: true, last_seen_at: ago(400) }, NOW, 300)).toBe("online");
  });

  it("reports never-seen and inactive stations", () => {
    expect(classifyStation({ is_active: true, is_online: false, last_seen_at: null }, NOW, 60)).toBe("never");
    expect(classifyStation({ is_active: false, is_online: true, last_seen_at: ago(5) }, NOW, 60)).toBe("inactive");
  });
});

describe("formatRelative", () => {
  it("formats seconds, minutes, hours and days", () => {
    expect(formatRelative(null, NOW)).toBe("never");
    expect(formatRelative(ago(3), NOW)).toBe("just now");
    expect(formatRelative(ago(45), NOW)).toBe("45 s ago");
    expect(formatRelative(ago(3 * 60 + 20), NOW)).toBe("3 min ago");
    expect(formatRelative(ago(2 * 3600), NOW)).toBe("2 h ago");
    expect(formatRelative(ago(4 * 86400), NOW)).toBe("4 d ago");
  });

  it("tolerates small clock skew", () => {
    expect(formatRelative(ago(-5), NOW)).toBe("just now");
  });
});

describe("clock drift", () => {
  it("warns above 30 s either way", () => {
    expect(driftLevel(-1240)).toBe("ok");
    expect(driftLevel(30_000)).toBe("ok");
    expect(driftLevel(30_001)).toBe("warning");
    expect(driftLevel(-45_000)).toBe("warning");
    expect(driftLevel(null)).toBe("unknown");
  });

  it("formats drift", () => {
    expect(formatDrift(850)).toBe("+850 ms");
    expect(formatDrift(-1240)).toBe("−1.2 s");
  });
});

describe("bucketHeartbeats", () => {
  it("puts heartbeats into 12 five-minute buckets, oldest first", () => {
    const beats = [ago(30), ago(90), ago(150), ago(59 * 60), ago(61 * 60)];
    const points = bucketHeartbeats(beats, NOW);
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ label: "60 min ago", count: 1 });
    expect(points[11]).toEqual({ label: "5 min ago", count: 3 });
    expect(points.reduce((s, p) => s + p.count, 0)).toBe(4);
  });
});

describe("groupFailures", () => {
  it("groups by error code with the latest reason, most frequent first", () => {
    const groups = groupFailures([
      { error_code: "OUTSIDE_GEOFENCE", failure_reason: "312 m", created_at: ago(500) },
      { error_code: "QR_EXPIRED", failure_reason: null, created_at: ago(100) },
      { error_code: "OUTSIDE_GEOFENCE", failure_reason: "140 m", created_at: ago(50) },
      { error_code: null, failure_reason: "?", created_at: ago(10) },
    ]);
    expect(groups.map((g) => [g.code, g.count])).toEqual([
      ["OUTSIDE_GEOFENCE", 2],
      ["UNKNOWN", 1],
      ["QR_EXPIRED", 1],
    ]);
    expect(groups[0]?.latestReason).toBe("140 m");
  });
});
