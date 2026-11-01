# 00 – Assumptions and Canonical Decisions

> **Role speaking: System Analyst** (with input from Software Engineer and Backend Developer)
>
> This file is the single source of truth for decisions that `development.md` leaves open.
> Every later artifact (requirements, ERD, migrations, Edge Functions, screens) MUST follow it.
> If a later phase needs to change a decision, update this file and note the affected roles.

## A. Identity, roles and accounts

| ID | Decision |
| --- | --- |
| D-01 | Roles: `admin`, `employee`, `kiosk`, `viewer` (enum `user_role`). Profile status: `pending`, `active`, `rejected`, `inactive` (enum `profile_status`). |
| D-02 | Only employees self-register on the website. Admin, kiosk and viewer accounts are created by an admin (or `seed.sql`) and start `active`. |
| D-03 | A kiosk account is a normal Supabase Auth user with role `kiosk`, linked to exactly one station via `stations.kiosk_user_id`. It can only call `issue-qr-token`, `kiosk-heartbeat`, `log-error` and read the recent-scan feed for its own station. |
| D-04 | Email verification is required before the registration is reviewed (Supabase Auth "Confirm email" on). |

## B. Device binding

| ID | Decision |
| --- | --- |
| D-05 | The mobile app generates a random installation UUID on first launch and stores it in SecureStore. It sends the raw value only over TLS to `bind-device` / `record-attendance`. The server stores `device_id_hash = HMAC-SHA256(DEVICE_HASH_PEPPER, raw_id)` (hex). Raw IDs are never stored. |
| D-06 | One active device per employee: unique partial index on `devices(employee_id) WHERE revoked_at IS NULL`. Same hash cannot be bound to two employees at once: unique partial index on `devices(device_id_hash) WHERE revoked_at IS NULL`. |
| D-07 | Admin "reset device" sets `revoked_at = now()`; the next login from any phone binds that phone. |

## C. Kiosk QR token

| ID | Decision |
| --- | --- |
| D-08 | Token payload `{ v:1, sid: station_id, n: nonce (uuid v4), iat: issued_at epoch ms, exp: expires_at epoch ms }`, encoded as `base64url(JSON) + "." + base64url(HMAC-SHA256(QR_SIGNING_SECRET, base64url(JSON)))`. QR content prefix: `BHWQR1:` + token. |
| D-09 | Lifetime 30 s (`app_settings.token_lifetime_seconds`), kiosk refreshes every 15 s (`token_refresh_seconds`), so two tokens overlap and a scan at the edge of a refresh still succeeds. |
| D-10 | "Single-use nonce" means **single use per employee**: a kiosk QR is shared by everyone in line, so the same nonce may be used by different employees but never twice by the same employee. Enforced by a new table `qr_nonce_uses (nonce, employee_id)` with a composite primary key. `qr_nonces` remains the registry of issued nonces (a nonce not found there is rejected as `QR_UNKNOWN`). |
| D-11 | Secret rotation: `QR_SIGNING_SECRET` and `QR_SIGNING_SECRET_PREVIOUS`; verification accepts either for the 60 s after rotation. Token header carries `kid` (`"cur"`/`"prev"` not needed — verify against both). |
| D-12 | Personal QR (fallback) uses the same format with prefix `BHWPQR1:` and payload `{ v:1, eid: employee_id, n, iat, exp }`, signed with `PERSONAL_QR_SIGNING_SECRET`, lifetime 30 s, refreshed every 15 s in the app. |

## D. Scan validation (order is fixed)

`record-attendance` validates in this exact order and stops at the first failure. Every attempt (success or failure) is written to `scan_attempts`.

| Step | Check | Error code | HTTP |
| --- | --- | --- | --- |
| 1 | Valid JWT | `AUTH_REQUIRED` | 401 |
| 2 | Rate limit (10 requests / minute / user) | `RATE_LIMITED` | 429 |
| 3 | Request body valid (zod) | `INVALID_REQUEST` | 400 |
| 4 | Profile role = employee and status = active | `ACCOUNT_NOT_ACTIVE` | 403 |
| 5 | Device bound and hash matches active device | `DEVICE_NOT_BOUND` / `DEVICE_MISMATCH` | 403 |
| 6 | Token format + HMAC signature | `QR_INVALID` | 400 |
| 7 | `now() <= exp` (server time) and `iat <= now() + 5 s` | `QR_EXPIRED` | 400 |
| 8 | Nonce exists in `qr_nonces` for that station | `QR_UNKNOWN` | 400 |
| 9 | Nonce not already used by this employee | `QR_REUSED` | 409 |
| 10 | Station exists and `is_active` | `STATION_INACTIVE` | 400 |
| 11 | GPS accuracy ≤ `max_gps_accuracy_m` (default 50 m) | `GPS_INACCURATE` | 400 |
| 12 | Haversine distance ≤ `stations.radius_m` (default 100 m, `app_settings.geofence_radius_m`) | `OUTSIDE_GEOFENCE` | 403 |
| 13 | No successful scan by this employee in the last `cooldown_minutes` (default 5) | `COOLDOWN_ACTIVE` | 429 |
| 14 | Day record not already closed (has time_in and time_out) | `ALREADY_COMPLETED` | 409 |
| 15 | Optional selfie present when `selfie_required = true` | `SELFIE_REQUIRED` | 400 |
| — | Unexpected error | `INTERNAL_ERROR` | 500 |

Mobile-only pre-scan codes (never sent to the server): `CAMERA_DENIED`, `LOCATION_DENIED`, `LOCATION_UNAVAILABLE`, `OFFLINE`, `BIOMETRIC_FAILED`.

Spec deviation, stated explicitly: rate limiting and request validation are inserted before the spec's list (auth → active status → device → signature → expiry → nonce reuse → geofence → cooldown) because they protect the server; GPS accuracy is checked just before geofence; `QR_UNKNOWN`, `STATION_INACTIVE`, `ALREADY_COMPLETED`, `SELFIE_REQUIRED` are added. The relative order of the spec's eight checks is preserved.

## E. Attendance rules

| ID | Decision |
| --- | --- |
| D-13 | **Work date** = Manila calendar date of the scan, except a scan between 00:00 and `overnight_cutoff_hour` (default 04:00) when the previous day's record has `time_in` and no `time_out`: that scan becomes the previous day's `time_out`. |
| D-14 | **Time-in vs time-out**: no record for the work date (or record with status `absent` created by the job) → time-in. Record with time_in and no time_out → time-out. Record with both → `ALREADY_COMPLETED`. Only one time-in/time-out pair per day (no lunch scan). |
| D-15 | **Lateness**: `time_in <= start_time + grace_minutes` → `minutes_late = 0`. Otherwise `minutes_late = time_in − start_time` (counted from start time, not from the end of grace). |
| D-16 | **Undertime**: `undertime_minutes = max(0, end_time − time_out)` (early departure only). Computed when time-out is recorded. |
| D-17 | **Status precedence** (one stored status): `absent` (no time_in on a work day) > `incomplete` (time_in, no time_out after end-of-day job) > `late` (minutes_late > 0) > `undertime` (undertime_minutes > 0) > `on_time`. `minutes_late` and `undertime_minutes` are both always stored, so a late + undertime day is `late` with both numbers kept. Before the time-out is recorded the record shows its provisional status (`on_time` or `late`). |
| D-18 | **Non-work days and holidays**: scans are accepted (field work, vaccination drives) and recorded with `minutes_late = 0`, `undertime_minutes = 0`, status `on_time`, `notes = 'Non-working day'` / holiday name. The end-of-day job never marks absences on non-work days or holidays. |
| D-19 | **Schedules**: `schedules` gets `break_start` (default 12:00) and `break_end` (default 13:00). `employee_schedules` effective-dated; the schedule in effect on the work date is used. An active employee without a schedule can scan; the record is stored with status `on_time`, `notes = 'No schedule assigned'`, and the periodic verification job flags them. Schedule changes never recompute past records (only the admin "recompute" RPC does, audited). |
| D-20 | **Cooldown** applies to successful scans only, measured from the employee's last successful scan (`scan_attempts`). |

## F. End-of-day job (pg_cron)

| ID | Decision |
| --- | --- |
| D-21 | Runs daily at `overnight_cutoff_hour + 5 min` Manila (04:05 = 20:05 UTC) for the **previous** work date: inserts `absent` rows for active employees with a schedule work day and no record (skip holidays); sets `incomplete` on records with time_in and no time_out. |

## G. DTR (CSC Form No. 48)

| ID | Decision |
| --- | --- |
| D-22 | One row per calendar day 1–31. If `time_in < break_start`: AM Arrival = time_in; else PM Arrival = time_in. If `time_out > break_end`: PM Departure = time_out; else AM Departure = time_out. Lunch cells not scanned are left blank unless `app_settings.dtr_fill_break_times = true`, in which case they show the schedule's break_start / break_end. Weekends/holidays show the day label ("Saturday", "Sunday", holiday name) when no scan exists. |
| D-23 | DTR **Undertime** column (hours, minutes) per day = `minutes_late + undertime_minutes` (CSC practice: tardiness and undertime both reduce service). Absent work days show the full scheduled minutes (end − start − break) as undertime and the word "Absent". Incomplete days show "No time-out" and undertime computed from break_end/end as recorded (0 until corrected). Monthly total = sum of daily values. |
| D-24 | Footer: certification text "I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.", employee signature line, "Verified as to the prescribed office hours:", in-charge signature line. "Regular days" and "Saturdays" header lines filled from the schedule. |

## H. Corrections

| ID | Decision |
| --- | --- |
| D-25 | Types: `missing_time_in`, `missing_time_out`, `wrong_time`, `official_business`. |
| D-26 | Eligibility: `work_date` not in the future, within the current month, or in the previous month while today ≤ `correction_window_days` (default 5) of the current month. One `pending` request per employee per work date. Attachment (image/PDF ≤ 5 MB) in private bucket `correction-attachments`. |
| D-27 | Employees may cancel their own pending request (status `cancelled`, added to the enum). Approval runs in one transaction: upsert attendance record (method `correction`... see D-28), recompute status, set request `approved`, write notification, audit. |
| D-28 | `attendance_method` enum: `qr`, `fallback_personal_qr`, `manual`, `correction`. (`correction` added so DTR and audit can tell approved requests apart.) `official_business` with both times blank sets times to the schedule start/end and notes "Official business". |

## I. Security and privacy

| ID | Decision |
| --- | --- |
| D-29 | Encrypted at rest: `contact_number` and `address` stored as `bytea` columns `contact_number_enc`, `address_enc` using `pgp_sym_encrypt` with key read from Supabase Vault secret `profile_encryption_key` inside `SECURITY DEFINER` functions. Plain values exposed only through `get_profile_private(uuid)` to the owner and admins. |
| D-30 | No biometric data is stored. Phone fingerprint/Face ID (`expo-local-authentication`) only unlocks the scan screen locally. |
| D-31 | Storage buckets (all private, signed URLs ≤ 60 min): `profile-photos`, `selfies`, `correction-attachments`. |
| D-32 | Retention: `qr_nonces` 1 day; `qr_nonce_uses` 1 day; `selfies` 30 days (`selfie_retention_days`); `scan_attempts` 1 year; `kiosk_heartbeats` 30 days; `error_logs` 180 days; `attendance_records`, `correction_requests`, `audit_logs` 5 years; `notifications` 1 year; rejected registrations deleted 90 days after rejection (counted from `profiles.approved_at`, the review time set by `reject_employee`). *Updated in Phase 1 review: `notifications` 1 year and the 90-day anchor added; affects Backend Developer (retention job FR-150) and System Administrator (job monitoring).* |

## J. Notifications

| ID | Decision |
| --- | --- |
| D-33 | New table `notifications (id, user_id, title, body, kind, read_at, created_at)` for in-app messages (web `/me`, mobile). Email for approval/rejection/correction outcome is sent by Edge Function `send-notification-email` via Resend when `RESEND_API_KEY` is set; otherwise in-app only. |

## K. Kiosk health

| ID | Decision |
| --- | --- |
| D-34 | Heartbeat every 60 s. A station is `is_online = false` when `last_seen_at < now() − 3 × heartbeat_interval` (3 min). Detected by pg_cron every minute; on transition to offline, a row is inserted into `error_logs` (source `kiosk`, severity `critical`) and Realtime pushes the station change to the dashboard. Clock drift = kiosk `Date.now()` − server time, warning above 30 s. |

## L. Extra tables added beyond the spec

`qr_nonce_uses`, `notifications`, and `stations.kiosk_user_id`, `stations.last_seen_at`, `stations.is_online`, `schedules.break_start`, `schedules.break_end`, `profiles.address_enc`, `profiles.contact_number_enc`, `profiles.email`, `profiles.approved_by`, `profiles.approved_at`, `scan_attempts.error_code`, `scan_attempts.nonce`, `scan_attempts.selfie_path`, `attendance_records.undertime_minutes`, `attendance_records.time_in_scan_id`, `attendance_records.time_out_scan_id`, `attendance_records.updated_at`.

## M. `app_settings` keys (single-row table, `id = 1`)

| Key | Default |
| --- | --- |
| `geofence_radius_m` | 100 |
| `max_gps_accuracy_m` | 50 |
| `cooldown_minutes` | 5 |
| `token_lifetime_seconds` | 30 |
| `token_refresh_seconds` | 15 |
| `selfie_required` | false |
| `selfie_retention_days` | 30 |
| `overnight_cutoff_hour` | 4 |
| `correction_window_days` | 5 |
| `heartbeat_interval_seconds` | 60 |
| `dtr_fill_break_times` | false |
| `office_name` | 'Barangay Kalawag II Health Workers Office' |
| `office_address` | 'Barangay Kalawag II, Isulan, Sultan Kudarat' (assumption, editable) |
