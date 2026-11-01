# 08 – Final Summary

> **Roles speaking: System Analyst, Software Engineer, Backend Developer, Frontend Designer / Developer, System Administrator**
>
> Status as of 2026-11-01, verified on the hosted **development** project (`zzspfykdcjsvpjriomwf`, eu-west-1). Production (Singapore) has not been created yet — see `03-deployment.md` and the go-live checklist in `04-operations.md`.

## 1. Original problem → feature → acceptance result

| Original problem (proposal) | Feature that solves it | Acceptance criteria | Result |
| --- | --- | --- | --- |
| Attendance written by hand in logbooks; checking is slow | Kiosk shows a rotating signed QR; the BHW scans it with the bound phone; time-in/out recorded in Supabase with server time | AC-02, AC-03, AC-04 | **Pass** — scan response p50 1.2 s / p95 1.6 s (target < 3 s); expired, reused, forged, out-of-range and low-accuracy scans rejected on the live project |
| Entries incomplete or inconsistent; buddy punching possible | Account approval, one bound phone per BHW, 30-second single-use QR, 100 m geofence, GPS accuracy check, 5-minute cooldown, anomaly flags, optional selfie | AC-01, AC-02, AC-03, AC-04 | **Pass** (automated); real-phone checks in UAT |
| Status (late, absent, undertime) computed by hand | Automatic classification from the approved schedule and grace period; end-of-day job marks absent and no time-out | AC-06 | **Partial** — monthly report totals = rows (automated); rule-level pgTAP tests written, not yet run |
| DTR (CSC Form 48) prepared by hand every month | DTR generated from records: web print (two copies, A4 landscape), PDF single and batch, mobile My DTR with PDF | AC-08, AC-09 | **Partial** — layout, 31 rows and PDF verified; totals-vs-records and correction→DTR pgTAP tests not yet run |
| Daily/weekly/monthly reports take a lot of work | Reports with barangay header, CSV export, print, charts; totals counted from the rows shown | AC-06 | **Partial** — monthly automated pass; daily/weekly in UAT |
| Mistakes cannot be fixed transparently | Correction requests with attachment → admin approve/reject with remarks → record and DTR update in one transaction; manual entry needs a reason; everything audited | AC-07, AC-08 | **Pending** pgTAP (bug found and fixed: a missing-time-in request now also applies its time-out) |
| Admin cannot see attendance at a glance | Live dashboard: stat cards, 7-day chart, live scans, alerts for approvals/corrections/offline kiosks/critical errors | AC-05 | **Pass** — scan visible on the dashboard 359–471 ms after the scan succeeds (browser test) |
| Device failures go unnoticed | Kiosk heartbeat every 60 s, offline after 3 missed (pg_cron every minute), Device Health page, mobile pre-scan health check | AC-10 | **Pass** (dashboard/Device Health); Error Logs entry for offline confirmed in UAT |
| Errors are invisible | `error_logs` from Edge Functions, kiosk, mobile and web; Error Logs page | AC-11 | **Partial** — Edge Function and mobile logging verified; kiosk logging in UAT |
| Personal data must be protected (RA 10173) | Consent at registration, encrypted contact/address (Vault key, rotation function), private storage, RLS per role, audit trail, retention jobs, no biometric data | AC-12 | **Pending** pgTAP for the at-rest check (decryption round trip verified through the API) |

## 2. Acceptance criteria

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC-01 | A pending user cannot use the mobile app | **Pass** | mobile `gate.test.ts`, `blocked.test.tsx`; web `guard.test.ts`; `record_scan` returns ACCOUNT_NOT_ACTIVE |
| AC-02 | A kiosk QR screenshot older than 30 s is rejected | **Pass** | Deno test (expired token), `smoke:functions` |
| AC-03 | The same QR cannot be used twice by the same user | **Pass** | `smoke:functions` "same QR again → QR_REUSED" |
| AC-04 | Scans outside the geofence are rejected with a clear message | **Pass** | `smoke:functions` (330 m → OUTSIDE_GEOFENCE), message EN/FIL in mobile tests |
| AC-05 | Dashboard updates within 2 s of a successful scan | **Pass** | `e2e/dashboard-latency.spec.ts`: 471 ms, 359 ms |
| AC-06 | Reports match the raw records exactly | **Partial** | monthly: `e2e/reports.spec.ts`, `smoke:remote`; daily/weekly: UAT |
| AC-07 | Every manual correction appears in the audit log with a reason | **Pending** | pgTAP `04_corrections_dtr_jobs` (written) |
| AC-08 | Approved correction updates the record and the DTR | **Pending** | pgTAP (written); fix migration `20261101000800` |
| AC-09 | DTR follows CSC Form 48 and totals match | **Partial** | layout/PDF automated; totals pgTAP |
| AC-10 | Silent kiosk shown offline within 3 minutes | **Pass** | cron every minute, 3 × 60 s; Device Health; pgTAP also written |
| AC-11 | Errors from functions, kiosk and mobile appear in Error Logs | **Partial** | `smoke:functions` log-error; kiosk in UAT |
| AC-12 | Sensitive fields encrypted at rest; no biometric data | **Pending** | pgTAP at-rest check; schema has no biometric columns (pass by design) |

Detailed cases: `01-test-cases-and-uat.md` (59 cases: 33 pass, 17 pending pgTAP, 9 pending manual UAT).

## 3. Study Recommendation compliance

| Recommended feature | Status | Where it is implemented |
| --- | --- | --- |
| Device + centralized database for time-in/time-out | **Done** | Kiosk `apps/web/app/kiosk`, mobile `apps/mobile/app/scan.tsx`, `record-attendance` Edge Function, `attendance_records` |
| Identity verification | **Done** | Supabase Auth + approval, `bind-device` (hashed IDs), signed rotating QR (`issue-qr-token`), geofence + GPS accuracy (`record_scan`), optional phone biometric unlock (`use-start-scan.tsx`) |
| Automatic Daily Time Records | **Done** | `dtr_month` / `get_dtr` / `get_dtr_batch`; web `/admin/dtr` (CSC Form 48 print + PDF, batch); `generate-dtr-pdf`; mobile My DTR |
| Attendance reports | **Done** | `get_daily/weekly/monthly_summary`; `/admin/reports`, `/viewer/reports` with CSV and print |
| Classification by approved schedule | **Done** | `compute_attendance_status`, `run_end_of_day` (pg_cron 04:05 Manila), recompute RPC |
| Alternative authentication for verification failure | **Done** | Personal rotating QR (`issue-personal-qr`, mobile My QR) scanned at `/admin/fallback-scan` (`record-fallback-scan`); manual entry with reason |
| Device health monitoring | **Done** | `kiosk-heartbeat`, `detect_offline_kiosks` (every minute), `/admin/device-health`, mobile pre-scan health check |
| Presentation-attack detection | **Done** | 30 s QR, single-use nonce per employee, screenshot/replay rejection, device binding, geofence, cooldown, anomaly flags, optional selfie (`selfie-capture.tsx`, `SELFIE_REQUIRED`) |
| Employee information management | **Done** | `/admin/employees`, `/admin/employees/[id]` (profile, status, device, schedule, history); photo upload needs `SUPABASE_SERVICE_ROLE_KEY` on the server |
| Correction requests with approval workflow | **Done** | Mobile correction form + My Requests; `/admin/corrections`; `review_correction_request` (one transaction, audited, notifies) |
| Device synchronization | **Done** | Server time everywhere; heartbeat + drift; mobile offline cache with refetch on reconnect; `device-sync` API contract (`supabase/functions/device-sync/README.md`) |
| Error logging | **Done** | `error_logs`, `log-error`, `/admin/error-logs`, failed scans in `scan_attempts` |
| Administrator dashboard | **Done** | `/admin` with live Realtime updates, alerts, trend chart, today table |
| Role-based access | **Done** | Roles admin/employee/kiosk/viewer; RLS on all 16 tables; proxy + `requireProfile`; RPC and Edge Function guards |
| Secure data handling + encryption | **Done** | TLS; `pgp_sym_encrypt` with Vault key + `rotate_profile_encryption_key`; private buckets + signed URLs; secrets only in Edge Function env; no biometric data |
| Audit trails | **Done** | Audit triggers on 9 tables, append-only `audit_logs`, `/admin/audit-log` |

All 16 recommended features are implemented. "Done" means built and deployed to the dev project; the remaining verification work is listed below.

## 4. Remaining before go-live

1. **Run the pgTAP suite** (`pnpm db:test:remote` with `supabase/.env.test.local` + `supabase/prod-ca-2021.crt`, or `pnpm db:test` once Docker works) — clears 17 pending test cases and AC-07/08/09/12.
2. **UAT on real phones and the kiosk tablet** with the form in `01-test-cases-and-uat.md` (9 manual cases, including camera scanning, biometric unlock, selfie and the stopwatch check of the stat cards).
3. **Production setup** per `03-deployment.md` and the go-live checklist in `04-operations.md`: Singapore project, Vault keys, Edge Function secrets, custom SMTP, Vercel, EAS build, kiosk tablet, first admin, station coordinates measured on site.
4. **Fill operator values:** Data Protection Officer contact (`DPO_CONTACT` in web and mobile privacy notices), portal address and contact numbers in the guides.
5. **Put the code on GitHub** so CI (`ci.yml`) and the nightly backup (`backup.yml`) run.
