# Phase 3 – Backend (Supabase)

> **Role speaking: Backend Developer** (System Administrator notes where deployment is affected)

## 1. Migrations (`supabase/migrations`)

| File | Contents |
| --- | --- |
| `20261101000000_schema.sql` | Extensions (pgcrypto, btree_gist, pg_cron, pg_net, vault), 10 enums, 16 tables with every constraint and index from the ERD, RLS enabled on all tables, single `app_settings` row |
| `20261101000100_helpers.sql` | `set_updated_at`, `app_role()`, `"current_role"()`, `is_admin()`, `is_viewer_or_admin()`, `is_active_employee()`, `assert_admin()`, `manila_today()`, `manila_minute()`, `manila_ts()`, `haversine_distance_m()`, `schedule_for()`, `is_work_day()`, `compute_attendance_status()`, PII encryption (`encrypt_pii`, `decrypt_pii`, `get_profile_private`, `update_my_contact`), profile-on-signup trigger `handle_new_user`, e-mail sync, kiosk-link check, notification + error helpers |
| `20261101000200_rls.sql` | Column-level grants and one-line-commented policies for every table and role |
| `20261101000300_audit.sql` | Audit trigger on 9 tables with encrypted-field redaction, append-only guard, `set_audit_context()` |
| `20261101000400_attendance_core.sql` | `resolve_punch` (D-13/D-14), `apply_punch`, `record_scan` (decisions §D steps 4–15), `record_fallback_scan`, `record_device_sync_event`, `register_qr_nonce`, `record_heartbeat`, `bind_device`, `check_device` |
| `20261101000500_admin_rpcs.sql` | `check_registration_available`, `list_pending_registrations`, `approve_employee`, `reject_employee`, `deactivate_employee`, `reactivate_employee`, `reset_device`, `assign_schedule`, `manual_attendance_entry`, `file_correction_request`, `cancel_correction_request`, `review_correction_request`, `recompute_attendance`, `get_active_stations`, `get_kiosk_feed` |
| `20261101000600_reports_dtr.sql` | `get_daily_summary`, `get_weekly_summary`, `get_monthly_summary`, `get_employee_history`, `get_dashboard_today`, `get_attendance_trend`, `dtr_month` (31 CSC Form 48 rows), `get_dtr`, `get_dtr_batch` |
| `20261101000700_jobs_storage_realtime.sql` | pg_cron jobs, storage buckets + policies, Realtime publication |

### Spec name note

`current_role()` is an SQL keyword (`CURRENT_ROLE`). The helper exists as `public."current_role"()` (must be called quoted and schema-qualified); code uses the equivalent `public.app_role()`.

## 2. RLS summary (one line per policy)

See the comment above each `create policy` in `20261101000200_rls.sql`. In short: employees read only their own rows and may only insert/cancel their own pending correction requests; admin reads all and writes through RPCs; viewer reads aggregates only through report RPCs; kiosk reads only its own station and writes only through `issue-qr-token` / `kiosk-heartbeat`; **no client role has an insert/update policy on `attendance_records`** (FR-61) — writes come only from Edge Functions (service role) and SECURITY DEFINER RPCs.

## 3. Edge Functions (`supabase/functions`)

| Function | Caller | Purpose |
| --- | --- | --- |
| `issue-qr-token` | kiosk (or admin preview) | Registers a nonce, returns `BHWQR1:` token signed with `QR_SIGNING_SECRET`, lifetime 30 s |
| `record-attendance` | employee app | Steps 1–3 + token checks, then `record_scan`; anomaly flags to `error_logs` |
| `bind-device` | employee app | Hashes the installation ID with `DEVICE_HASH_PEPPER`, binds one phone |
| `issue-personal-qr` | employee app | `BHWPQR1:` personal fallback QR, only on the bound phone |
| `record-fallback-scan` | admin web | Verifies personal QR, records `fallback_personal_qr` |
| `kiosk-heartbeat` | kiosk | Heartbeat, drift, online flag |
| `log-error` | kiosk, mobile, web | Inserts into `error_logs` |
| `device-sync` | future fingerprint terminal | Documented contract in `device-sync/README.md` |
| `generate-dtr-pdf` | employee app, admin | CSC Form 48 PDF (pdf-lib), duplicate copies on A4 landscape |
| `send-notification-email` | admin web | Optional Resend e-mail |
| `storage-cleanup` | pg_cron (service key) | Deletes expired files through the Storage API |

`_shared/`: `cors.ts`, `hmac.ts` (sign/verify with rotation, device hash), `http.ts` (shared error format), `supabase.ts` (admin client, caller, `logError`), `rate-limit.ts`, `schemas.ts`, `error-codes.generated.ts` (generated from the Phase 1 catalog by `pnpm --filter @bhw/types gen:errors`).

All functions set `verify_jwt = false` in `config.toml` and validate the caller themselves, so they can answer in the shared `{ ok, code, message, params }` format and log `AUTH_REQUIRED` scan attempts.

## 4. Scheduled jobs (pg_cron, UTC → Manila)

| Job | Cron (UTC) | Manila | Function |
| --- | --- | --- | --- |
| `bhw-end-of-day` | `5 20 * * *` | 04:05 daily | `run_end_of_day()` – absent + incomplete for the previous day |
| `bhw-offline-kiosks` | `* * * * *` | every minute | `detect_offline_kiosks()` – offline after 3 missed heartbeats, critical error + admin notification |
| `bhw-nonce-cleanup` | `0 * * * *` | hourly | `cleanup_nonces()` |
| `bhw-periodic-verification` | `0 22 * * 0` | Monday 06:00 | `run_periodic_verification()` |
| `bhw-storage-cleanup` | `15 18 * * *` | 02:15 daily | `storage-cleanup` Edge Function via `pg_net` |
| `bhw-retention` | `30 18 * * *` | 02:30 daily | `run_retention()` |

> **System Administrator note:** `bhw-storage-cleanup` needs two Vault secrets on the hosted project: `select vault.create_secret('https://<ref>.supabase.co', 'project_url'); select vault.create_secret('<service-role key>', 'service_role_key');`. Without them the job does nothing.

## 5. Realtime

Publication `supabase_realtime`: `attendance_records`, `stations`, `correction_requests`, `notifications`, `scan_attempts`. RLS applies to `postgres_changes`, so the admin dashboard receives all rows and an employee only their own. Suggested subscriptions:

| Screen | Table | Filter |
| --- | --- | --- |
| Admin dashboard | `attendance_records` | `work_date=eq.<manila today>` |
| Admin dashboard alerts | `stations` | `is_online=eq.false` |
| Kiosk feed | (RPC `get_kiosk_feed` refreshed on a broadcast / every 10 s) | own station |
| Mobile Home | `attendance_records` | `employee_id=eq.<uid>` |
| Notifications bell | `notifications` | `user_id=eq.<uid>` |

## 6. Seed (`supabase/seed.sql`)

1 admin, 1 kiosk, 1 viewer, 8 BHWs (Filipino names), 1 station (6.6311, 124.6047), schedule Mon–Fri 08:00–17:00 with 15-min grace, 2 PH holidays (All Saints' Day, Bonifacio Day), two weeks of attendance with late / absent / undertime / no time-out cases, sample failed scans, one pending correction. Password for all demo accounts: `BhwDemo#2026`. **Local/demo only.**

## 7. Commands

```bash
pnpm db:start                 # local stack (Docker)
pnpm db:reset                 # migrations + seed
pnpm db:types                 # packages/types/src/database.types.ts
pnpm db:test                  # pgTAP: supabase/tests/database/*.test.sql
deno test --allow-env supabase/functions   # Edge Function tests
pnpm functions:serve          # local Edge Functions with supabase/functions/.env
```

## 8. Tests

| File | Covers |
| --- | --- |
| `tests/database/01_status_logic.test.sql` | Grace, lateness from start time, second truncation, undertime, late+undertime, incomplete, absent, holiday, non-working day, no schedule, Manila date, haversine, constraints |
| `tests/database/02_record_scan.test.sql` | Every `record_scan` step 4–15, time-in, time-out, single use per employee, attempts logged, device reset |
| `tests/database/03_rls.test.sql` | anon, employee, viewer, kiosk, admin access |
| `tests/database/04_corrections_dtr_jobs.test.sql` | End-of-day job, correction file/duplicate/eligibility/reject/approve → record + DTR, manual entry audit, DTR totals, monthly report totals, kiosk offline, encryption at rest |
| `functions/record-attendance/handler.test.ts` | Every `record-attendance` failure code and HTTP status, expired/forged tokens, secret rotation, success message |

## 9. Verification results (2026-11-01, hosted dev project `zzspfykdcjsvpjriomwf`)

| Check | Command | Result |
| --- | --- | --- |
| Migrations + seed applied to an empty project | `pnpm db:push` (`supabase db push --linked --include-seed`) | 8/8 migrations, seed OK |
| Generated DB types | `pnpm db:types:remote` | 1,490 lines, all tables and RPCs |
| Edge Function unit tests | `pnpm functions:test` | 21/21 pass |
| Edge Functions type check | `deno check */index.ts` | 11/11 pass |
| Deploy | `supabase functions deploy --use-api` | 11/11 deployed |
| RLS + RPCs per role through the public API | `pnpm smoke:remote` | 22/22 pass |
| End-to-end scan flow through deployed functions | `pnpm smoke:functions` | 14/14 pass |
| pgTAP files (`supabase/tests/database`) | `pnpm db:test:remote` (needs `supabase/.env.test.local` + `supabase/prod-ca-2021.crt`) or `pnpm db:test` (local Docker) | **Not executed yet** – Docker on the dev PC is broken and no direct DB connection was configured |

> **System Administrator note:** Edge Function secrets were generated with `pnpm secrets:gen` and uploaded with `npx supabase secrets set --env-file supabase/functions/.env` by the project owner. The dev project is in `eu-west-1` (Ireland); production should be created in `ap-southeast-1` (Singapore).
>
> **Backend Developer note:** Edge Functions import packages with explicit `npm:`/`jsr:` specifiers because server-side bundling (`--use-api`) does not read `supabase/functions/deno.json`.
