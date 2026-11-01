// Old-vs-new comparison for audit_logs rows (FR-126..FR-130).

export type DiffKind = "added" | "removed" | "changed" | "unchanged";

export interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
  kind: DiffKind;
}

/** Placeholders written by audit_redact() for encrypted columns (FR-130). */
const REDACTED_CHANGED = "[changed]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Order-insensitive deep equality for JSON values. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  if (isRecord(a) && isRecord(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]));
  }
  return false;
}

/**
 * Top-level key diff of an audit row. Keys present only in `after` are "added" (insert, or a
 * named action's "reason"), only in `before` are "removed" (delete). An encrypted column redacted
 * as "[changed]" on both sides is still reported as changed. Changed keys are listed first.
 */
export function diffAuditRow(before: unknown, after: unknown): DiffRow[] {
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  const rank: Record<DiffKind, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return keys
    .map((key): DiffRow => {
      const inB = Object.prototype.hasOwnProperty.call(b, key);
      const inA = Object.prototype.hasOwnProperty.call(a, key);
      let kind: DiffKind;
      if (!inB) kind = "added";
      else if (!inA) kind = "removed";
      else if (b[key] === REDACTED_CHANGED || a[key] === REDACTED_CHANGED) kind = "changed";
      else kind = jsonEqual(b[key], a[key]) ? "unchanged" : "changed";
      return { key, before: inB ? b[key] : undefined, after: inA ? a[key] : undefined, kind };
    })
    .sort((x, y) => rank[x.kind] - rank[y.kind] || x.key.localeCompare(y.key));
}

/** Short one-line rendering of a JSON value for diff cells. */
export function formatJsonValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Pretty JSON for the details sheet. */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

/** Names of changed/added/removed keys, e.g. for the table's "Changed" column. */
export function changedKeys(before: unknown, after: unknown): string[] {
  return diffAuditRow(before, after)
    .filter((r) => r.kind !== "unchanged")
    .map((r) => r.key);
}
