// Fixed-window rate limiter kept in the isolate's memory. Edge isolates are reused for many
// requests, so this stops bursts from one client cheaply; record-attendance additionally counts
// scan_attempts rows in the database, which holds across isolates.

const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    }
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

export function resetRateLimits(): void {
  windows.clear();
}
