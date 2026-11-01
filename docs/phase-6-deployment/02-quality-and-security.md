# 02 – Quality, Security and Performance

> **Role speaking: Software Engineer**

## 1. Test commands

| Suite | Command (repo root unless noted) | Result 2026-11-01 |
| --- | --- | --- |
| Shared packages | `pnpm --filter @bhw/types test`, `pnpm --filter @bhw/design-tokens test` | 7 + 4 pass |
| Web unit (Vitest) | `pnpm --filter @bhw/web test` | 22 files, 223 tests pass |
| Web E2E (Playwright, against `next start`) | `cd apps/web && npx playwright test` | 24 pass, 1 skipped (dashboard latency, `PERF=1`): smoke, kiosk, reports, page sweep, responsive at 360/768/1280 px, register → approve → login |
| Dashboard latency (AC-05, writes demo data) | `cd apps/web && set PERF=1&& set PERF_BHW=<demo bhw>&& npx playwright test e2e/dashboard-latency.spec.ts` | 471 ms and 359 ms |
| Mobile (Jest + RNTL) | `pnpm --filter @bhw/mobile test` | 14 suites, 85 tests pass |
| Edge Functions (Deno) | `pnpm functions:test` | 21 pass |
| Database (pgTAP) | `pnpm db:test` (local Docker) or `pnpm db:test:remote` (`supabase/.env.test.local` + CA file) | **Not executed yet** |
| Deployed API per role | `pnpm smoke:remote` | 22 pass |
| Deployed scan flow | `pnpm smoke:functions` | 14 pass |
| Scan latency | `node scripts/perf-check.mjs 8` | see §4 |
| Lint / types | `pnpm lint`, `pnpm typecheck` | 0 problems |
| Production build | `pnpm --filter @bhw/web build` | 32 routes |
| Mobile bundle | `cd apps/mobile && npx expo export --platform android` + `npx expo-doctor` | OK, 20/20 |

CI (`.github/workflows/ci.yml`) runs lint, types, unit tests, the web build, Deno tests and pgTAP on every push and pull request.

## 2. Coverage targets

| Layer | Target (Phase 2) | Status |
| --- | --- | --- |
| Shared packages | 90 % lines | Schemas, QR parsing, messages and tokens all have tests; line coverage not instrumented yet |
| Database | every policy and every BR with a formula | Written (4 pgTAP files); **runs pending** |
| Edge Functions | 100 % of `record-attendance` error branches | Met: all 17 codes + forged/expired/future tokens + rotation |
| Web unit | 70 % lines | 223 tests over all helpers (guard, format, CSV, DTR, reports, attendance, setup, monitoring, kiosk, auth); instrumentation (`vitest --coverage` with `@vitest/coverage-v8`) to be added in CI |
| Mobile | 70 % of `lib/` and scan screens | Scan result, health check, auth gate, overlay, Blocked, Home, history, corrections, DTR, QR covered |

## 3. Security checklist (OWASP Top 10, 2021)

| Risk | Control in this system | Status |
| --- | --- | --- |
| A01 Broken access control | RLS on all 16 tables; admin RPCs call `assert_admin()`; Edge Functions re-check role/status; web proxy + `requireProfile`; no client insert/update policy on `attendance_records` | ✅ verified per role (`smoke:remote` 22/22) |
| A02 Cryptographic failures | TLS everywhere (Supabase, Vercel); contact number/address `pgp_sym_encrypt` with Vault key; QR tokens HMAC-SHA256 with server-only secrets and rotation; device IDs stored only as HMAC hashes | ✅ (encryption checked through `get_profile_private`; at-rest bytes check is in pgTAP) |
| A03 Injection | Parameterised PostgREST/RPC calls only; SQL functions use `search_path = ''`; zod validation on every input; CSV export neutralises spreadsheet formulas | ✅ |
| A04 Insecure design | Server time only; single-use nonce per employee; 30 s QR; geofence + accuracy + cooldown; device binding; scans never queued offline | ✅ |
| A05 Security misconfiguration | Private storage buckets with folder-scoped policies; service-role key server-only (`server-only` import); `verify_jwt=false` functions all verify the caller themselves; anon has no table grants | ✅ — production must set custom SMTP and disable unused auth providers (go-live checklist) |
| A06 Vulnerable components | Pinned versions; lockfile; Dependabot recommended | ⚠️ enable Dependabot / `pnpm audit` in CI |
| A07 Identification & authentication | Supabase Auth, email confirmation, password ≥ 8, refresh-token rotation; local JWT verification (`getClaims`) | ✅ |
| A08 Software & data integrity | Audit triggers on 9 tables, append-only `audit_logs`; signed QR; EAS-signed builds | ✅ |
| A09 Logging & monitoring | `error_logs` from functions/kiosk/mobile/web; anomaly flags; kiosk offline alerts; weekly verification | ✅ |
| A10 SSRF | No server-side fetch of user-supplied URLs (only Resend and Supabase endpoints) | ✅ |

Additional: open-redirect protection on `/auth/callback` (`safeNext`); rate limits on every Edge Function (scan: 10/min/user, database-backed); no biometric data stored; personal data cleared on mobile logout.

## 4. Performance (measured 2026-11-01, dev project in **eu-west-1**, client in the Philippines)

| Metric | Target | Measured | Result |
| --- | --- | --- | --- |
| Scan response (`record-attendance`, warm) | < 3 s (NFR-02) | p50 **1.20 s**, p95 **1.56 s** (8 scans) | ✅ |
| Scan response, first call after deploy (cold) | — | 4.6 s once | expected cold start; see note |
| Dashboard shows a successful scan (AC-05) | < 2 s | **471 ms**, **359 ms** (Playwright, browser) | ✅ |
| Realtime event after scan request sent | — | p50 1.36 s, p95 1.99 s | (includes the scan's own processing) |

Optimisations made to reach these numbers:

1. `record-attendance` verifies the JWT locally (`auth.getClaims`) instead of a network call to Auth.
2. The rate-limit count, HMAC verification and device hashing run concurrently; decisions keep the fixed order of decisions §D.
3. Anomaly flags are written after the response (`EdgeRuntime.waitUntil`).
4. The admin dashboard joins Realtime with the admin's JWT (it previously joined as anon and RLS hid every event) and shows the new scan from the Realtime payload immediately; the full server refresh follows in the background.

> **System Administrator note:** production in **ap-southeast-1 (Singapore)** cuts each database round trip from ~250 ms to ~40 ms, so production latency will be well below these figures. Cold starts happen after deploys and long idle periods; the kiosk heartbeat keeps related functions warm during office hours.
