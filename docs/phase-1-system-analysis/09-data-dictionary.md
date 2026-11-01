> **Role speaking: System Analyst**

# 09 – Data Dictionary

This data dictionary describes every table, column and enum of the BHW QR Attendance System database (Supabase Postgres, schema `public`). It covers all tables in the **DATABASE** section of `development.md`, the additions in section L of [`00-assumptions-and-decisions.md`](./00-assumptions-and-decisions.md) (`qr_nonce_uses`, `notifications` and the extra columns), and `app_settings` with every key of section M as a typed column. The last section describes the row shapes returned by the DTR and report functions.

Column names match the spec exactly. Where this document had to choose something the spec leaves open (for example the exact Postgres type), the choice is listed in [section 2](#2-clarifications-of-the-spec). Functional requirements (FR-xx) are in [`02-functional-requirements.md`](./02-functional-requirements.md). Retention periods come from D-32.

---

## 1. Conventions

| Item | Convention |
| --- | --- |
| Primary keys | `uuid DEFAULT gen_random_uuid()` unless stated otherwise. `profiles.id` is the Supabase Auth user ID. |
| Time stamps | `timestamptz`. Postgres stores them in UTC. Every screen, report, CSV and DTR shows them in **Asia/Manila** (UTC+08:00). Samples below are written in Manila time (`+08`). |
| Work date | `date` = the Manila calendar date (`(now() AT TIME ZONE 'Asia/Manila')::date`, wrapped by the helper `manila_today()`), with the overnight rule of D-13. |
| Time of day | `time` (without time zone) = Manila wall-clock time, used for schedules. |
| Coordinates | `numeric(9,6)` decimal degrees (about 0.11 m precision). Samples are near the BHW Office in Kalawag II, Isulan, Sultan Kudarat (about 6.63 N, 124.60 E). |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`, set once and never changed. |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()`, refreshed by a `BEFORE UPDATE` trigger `set_updated_at()`. |
| Storage references | Columns that point to files (`photo_url`, `attachment_url`, `selfie_path`) hold the **object path inside a private bucket**, never a public URL. Apps get a signed URL (at most 60 minutes) when they need to show the file (D-31). |
| Encrypted columns | `bytea` columns ending in `_enc` hold `pgp_sym_encrypt(plain_text, key)` output. The key is the Supabase Vault secret `profile_encryption_key`. Only `SECURITY DEFINER` functions decrypt them (D-29). |
| Text checks | Free-text columns are trimmed by the API. Length limits are enforced by `CHECK (char_length(...) ...)`. |
| RLS | Row Level Security is enabled on **every** table. `service_role` (used only inside Edge Functions and `SECURITY DEFINER` functions) bypasses RLS. "No client access" means no policy grants the `anon` or `authenticated` role anything. |
| Audit | Tables marked "Audited" have the `audit_row_change()` trigger, which writes one `audit_logs` row per insert, update or delete (FR-126), except `stations` updates that change only `last_seen_at` and `is_online` (see the Backend Developer note under `stations`). |

---

## 2. Clarifications of the spec

| # | Spec text | How it is stored | Reason |
| --- | --- | --- | --- |
| 1 | `profiles.contact_number` | `profiles.contact_number_enc bytea` (plus `address_enc bytea`) | D-29: sensitive fields encrypted at rest. The plain value is returned only by `get_profile_private(uuid)` to the owner and admins. |
| 2 | `profiles.photo_url` | Storage path in bucket `profile-photos` | D-31: private bucket, signed URLs only. |
| 3 | `profiles.email` (section L) | Copy of `auth.users.email` | Lets the admin list and search employees without reading the `auth` schema. Kept in sync by a trigger on `auth.users`. |
| 4 | `schedules.work_days int[]` | `int[]` (as in the spec) with ISO weekdays 1 = Monday … 7 = Sunday | Same values as `extract(isodow from work_date)`. All small counters in this schema use `integer`, matching `08-erd.md`. |
| 5 | `stations.radius_m` | `integer NULL`, range 10–1000 m; NULL means "use `app_settings.geofence_radius_m`" | Decisions section D step 12: station radius with a default of 100 m taken from settings, so changing the setting updates every station that has no own radius (same rule as `08-erd.md` section 5, BR-37, FR-108). |
| 6 | `employee_schedules` has no `id` | Primary key `(employee_id, effective_from)` | An employee cannot have two assignments that start on the same date; overlap is blocked by an exclusion constraint. |
| 7 | `audit_logs.record_id` | `text` | Audited tables have different key types (`uuid`, `date` for `holidays`, `integer` for `app_settings`, composite for `employee_schedules`). |
| 8 | `qr_nonce_uses` (D-10) | No foreign key to `qr_nonces` | The table also records personal-QR nonces (D-12), which are not registered in `qr_nonces`. Both tables are purged after 1 day. |
| 9 | `bhw_id_number unique` | `UNIQUE`, nullable, required by `CHECK` when `role = 'employee'` | Admin, kiosk and viewer accounts have no BHW ID number. |
| 10 | `dtr_month` "SQL view / RPC" | Set-returning SQL function `dtr_month(p_employee_id, p_year, p_month)` used by the RPC `get_dtr` | A plain view cannot take the employee and month as parameters. |

---

## 3. Enums

| Enum | Values (in order) | Used by | Notes |
| --- | --- | --- | --- |
| `user_role` | `admin`, `employee`, `kiosk`, `viewer` | `profiles.role` | D-01. Self-registration always creates `employee` (FR-05). |
| `profile_status` | `pending`, `active`, `rejected`, `inactive` | `profiles.status` | D-01. Only `active` employees can bind a device, scan or show a personal QR (FR-28, FR-15). |
| `attendance_status` | `on_time`, `late`, `absent`, `undertime`, `incomplete` | `attendance_records.status` | One stored status per day. Precedence absent > incomplete > late > undertime > on_time (D-17). |
| `attendance_method` | `qr`, `fallback_personal_qr`, `manual`, `correction` | `attendance_records.method` | D-28. `correction` marks values written by an approved correction request. |
| `correction_type` | `missing_time_in`, `missing_time_out`, `wrong_time`, `official_business` | `correction_requests.type` | D-25. |
| `correction_status` | `pending`, `approved`, `rejected`, `cancelled` | `correction_requests.status` | D-27 adds `cancelled` (employee cancels own pending request). |
| `error_source` | `edge_function`, `kiosk`, `mobile`, `web` | `error_logs.source` | From the spec. pg_cron job failures use `edge_function` with `context.job` set (FR-151). |
| `error_severity` | `info`, `warning`, `error`, `critical` | `error_logs.severity` | Kiosk offline transitions are `critical` (D-34). |
| `device_platform` | `android`, `ios` | `devices.platform` | Expo app targets Android first; iOS is supported but store publishing is optional (scope). |
| `notification_kind` | `registration_approved`, `registration_rejected`, `correction_approved`, `correction_rejected`, `device_reset`, `record_incomplete`, `new_registration`, `new_correction_request`, `kiosk_offline`, `periodic_verification` | `notifications.kind` | FR-144, FR-145, FR-110, FR-149, D-33, D-34. Same 10 values as `08-erd.md` section 4. The first six go to employees, the last four to admins. |

Server scan error codes (section D) are stored as `text` in `scan_attempts.error_code` with a `CHECK` list of exactly the 17 section D codes, as in `08-erd.md` section 4, so no other value can be stored. Allowed values: `AUTH_REQUIRED`, `RATE_LIMITED`, `INVALID_REQUEST`, `ACCOUNT_NOT_ACTIVE`, `DEVICE_NOT_BOUND`, `DEVICE_MISMATCH`, `QR_INVALID`, `QR_EXPIRED`, `QR_UNKNOWN`, `QR_REUSED`, `STATION_INACTIVE`, `GPS_INACCURATE`, `OUTSIDE_GEOFENCE`, `COOLDOWN_ACTIVE`, `ALREADY_COMPLETED`, `SELFIE_REQUIRED`, `INTERNAL_ERROR`. The mobile-only codes (`CAMERA_DENIED`, `LOCATION_DENIED`, `LOCATION_UNAVAILABLE`, `OFFLINE`, `BIOMETRIC_FAILED`) never reach the database.

---

## 4. Table overview

| # | Table | Purpose | Audited | Retention (D-32) |
| --- | --- | --- | --- | --- |
| 1 | `profiles` | One row per user account: identity, role, status | Yes | While the account exists; rejected registrations deleted 90 days after rejection |
| 2 | `schedules` | Work schedule templates | Yes | Kept while referenced; never deleted once assigned |
| 3 | `employee_schedules` | Effective-dated schedule assignment | Yes | Same as the employee's profile |
| 4 | `stations` | Kiosk QR stations with geofence and health | Yes | Kept; deactivated instead of deleted |
| 5 | `devices` | Phones bound to employees (hashed ID) | Yes | Same as the employee's profile |
| 6 | `qr_nonces` | Registry of issued kiosk QR nonces | No | 1 day |
| 7 | `qr_nonce_uses` | Which employee used which nonce | No | 1 day |
| 8 | `attendance_records` | One row per employee per work date | Yes | 5 years |
| 9 | `scan_attempts` | Every scan attempt, success or failure | No | 1 year (selfie files 30 days) |
| 10 | `audit_logs` | Append-only change history | No (is the audit) | 5 years |
| 11 | `holidays` | Non-working holidays | Yes | Kept |
| 12 | `app_settings` | Single-row system settings | Yes | Single row, never deleted |
| 13 | `correction_requests` | Employee correction requests and reviews | Yes | 5 years (attachment deleted with the request) |
| 14 | `kiosk_heartbeats` | Kiosk heartbeat history | No | 30 days |
| 15 | `error_logs` | Errors from Edge Functions, kiosk, mobile, web | No | 180 days |
| 16 | `notifications` | In-app messages | No | 1 year |

---

## 5. Tables

### 5.1 `profiles`

**Purpose:** One row per Supabase Auth user. Holds the BHW's identity, role and account status. Created automatically by the `handle_new_user()` trigger on `auth.users` with role `employee` and status `pending` (FR-05); admin, kiosk and viewer rows are created by an admin or `seed.sql` with status `active` (D-02).

**RLS:** Employee, kiosk and viewer read only their own row. An employee may change only their own contact number, address and photo, and only through a `SECURITY DEFINER` function that encrypts the values (FR-18); `role`, `status`, `bhw_id_number`, `full_name`, `area`, `approved_*` and `rejection_reason` can never be changed by the owner. Admin reads and updates all rows, and changes status only through `approve_employee`, `reject_employee` and `deactivate_employee`. Viewers never read other profiles directly; report RPCs give them names and areas only (NFR-31). No client may insert or delete (insert is done by the trigger).

**Retention:** Kept while the account exists and while attendance records reference it (5 years). Rejected registrations are deleted 90 days after rejection, counted from `approved_at`, which `reject_employee` sets to the rejection time (for both outcomes `approved_by` / `approved_at` mean "reviewed by / reviewed at", and `status` tells which outcome it was; see the Backend Developer note in `08-erd.md`). On a verified erasure request (FR-20) `contact_number_enc`, `address_enc` and `photo_url` are set to NULL and the photo object is deleted.

**Indexes:** unique `bhw_id_number`; unique `lower(email)`; `(role, status)`; `area`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; FK → `auth.users.id` ON DELETE CASCADE | Supabase Auth user ID. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `full_name` | `text` | NOT NULL; CHECK `char_length(full_name) BETWEEN 2 AND 100` (BR-10) | Full name as written on the DTR (first name, middle initial, surname). | `Maria Luz D. Santos` |
| `bhw_id_number` | `text` | UNIQUE; CHECK `role <> 'employee' OR bhw_id_number IS NOT NULL`; CHECK `char_length(bhw_id_number) BETWEEN 3 AND 30` | BHW ID number issued by the barangay. NULL for admin, kiosk and viewer accounts. | `BHW-KII-2021-014` |
| `area` | `text` | CHECK `role <> 'employee' OR area IS NOT NULL`; CHECK `char_length(area) <= 80` | Purok or area the BHW covers. Used in report filters. | `Purok Malipayon` |
| `email` | `text` | NOT NULL; UNIQUE (`lower(email)`) | Copy of `auth.users.email`, kept in sync by trigger, for admin listing and search. | `marialuz.santos@gmail.com` |
| `contact_number_enc` | `bytea` | NULL allowed | Mobile number (`09XXXXXXXXX`) encrypted with `pgp_sym_encrypt`. This is the spec's `contact_number`, stored encrypted (D-29). Required at registration by the form (FR-02); NULL only after erasure. | `\xc30d040703022b9e4f1a7c...` (decrypts to `09171234567`) |
| `address_enc` | `bytea` | NULL allowed | Optional home address, encrypted like the contact number (D-29). | `\xc30d04070302a41f88d03e...` (decrypts to `Purok Malipayon, Brgy. Kalawag II, Isulan, Sultan Kudarat`) |
| `photo_url` | `text` | NULL allowed; CHECK `photo_url ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'` | Object path inside the private bucket `profile-photos` (folder = user ID). Not a public URL (FR-06). | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10/photo-20261005.jpg` |
| `role` | `user_role` | NOT NULL; DEFAULT `'employee'` | Account role (D-01). | `employee` |
| `status` | `profile_status` | NOT NULL; DEFAULT `'pending'` | Account status. Only `active` may use the mobile app (AC-01). | `active` |
| `rejection_reason` | `text` | CHECK `status <> 'rejected' OR char_length(btrim(rejection_reason)) >= 10` (BR-13); CHECK `char_length(rejection_reason) <= 500` | Reason shown on `/rejected` and in the rejection notice (FR-23). | `BHW ID number does not match the barangay roster. Please visit the BHW Office.` |
| `approved_by` | `uuid` | FK → `profiles.id` ON DELETE SET NULL | Admin who reviewed (approved or rejected) the registration (FR-22, FR-23). | `9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08` |
| `approved_at` | `timestamptz` | CHECK `approved_by IS NULL OR approved_at IS NOT NULL` | Time of review (approval or rejection). Anchor of the 90-day deletion of rejected registrations (D-32). | `2026-09-29 10:14:03+08` |
| `consent_at` | `timestamptz` | CHECK `role <> 'employee' OR consent_at IS NOT NULL` | Time the registrant ticked the Data Privacy consent (FR-03, RA 10173). | `2026-09-27 19:42:51+08` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Registration / account creation time. | `2026-09-27 19:42:51+08` |
| `updated_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Last change (trigger). | `2026-09-29 10:14:03+08` |

> **Backend Developer note:** The `audit_row_change()` trigger replaces `contact_number_enc` and `address_enc` values with the string `"[changed]"` (or `"[unchanged]"`) in `old_data`/`new_data`, so ciphertext and plain text never appear in `audit_logs` (FR-130).

---

### 5.2 `schedules`

**Purpose:** Named work schedule templates with work days, office hours, grace period and lunch break (D-19). Status computation (D-15, D-16) and the DTR AM/PM split (D-22) read the schedule in effect on the work date.

**RLS:** Admin full access (delete blocked by the foreign key once assigned, FR-107). Employees read only schedules assigned to them (through `employee_schedules`). Viewers and kiosks have no direct access.

**Retention:** Kept as long as any `employee_schedules` row references it (ON DELETE RESTRICT), so historical DTRs can always be rebuilt.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Schedule ID. | `5d0e9b7c-3a21-4f08-b6c4-71e2a9d03b55` |
| `name` | `text` | NOT NULL; UNIQUE; CHECK `char_length(name) BETWEEN 2 AND 80` | Display name. | `Regular Mon–Fri 8–5` |
| `work_days` | `int[]` | NOT NULL; CHECK `cardinality(work_days) BETWEEN 1 AND 7`; CHECK `work_days <@ ARRAY[1,2,3,4,5,6,7]::int[]` | ISO weekdays that are work days (1 = Monday … 7 = Sunday). | `{1,2,3,4,5}` |
| `start_time` | `time` | NOT NULL | Official start of work (Manila). | `08:00` |
| `end_time` | `time` | NOT NULL; CHECK `end_time > start_time` | Official end of work (Manila). | `17:00` |
| `grace_minutes` | `integer` | NOT NULL; DEFAULT `15`; CHECK `grace_minutes BETWEEN 0 AND 60` | Minutes after `start_time` still counted as on time (D-15). | `15` |
| `break_start` | `time` | NOT NULL; DEFAULT `'12:00'`; CHECK `break_start >= start_time AND break_start < break_end` | Lunch break start; splits AM and PM on the DTR (D-22). | `12:00` |
| `break_end` | `time` | NOT NULL; DEFAULT `'13:00'`; CHECK `break_end <= end_time` | Lunch break end. | `13:00` |
| `created_by` | `uuid` | FK → `profiles.id` ON DELETE SET NULL | Admin who created the schedule. | `9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Creation time. | `2026-09-01 09:00:00+08` |
| `updated_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Last change. | `2026-09-01 09:00:00+08` |

---

### 5.3 `employee_schedules`

**Purpose:** Assigns a schedule to an employee for a date range (effective-dated, D-19). The row whose range contains the work date is the schedule used for that day. Created on approval (FR-22) and when the admin changes a schedule (FR-16).

**RLS:** Admin full access. An employee reads only their own rows. No access for viewer or kiosk.

**Retention:** Same as the employee's profile (ON DELETE CASCADE, `08-erd.md` R-04). An employee who has attendance records cannot be deleted (`attendance_records.employee_id` is RESTRICT), so the cascade only removes the assignments of profiles with no attendance, such as a rejected registration; past DTRs always keep their schedule.

**Other constraints:** `EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to, '[]') WITH &&)` (extension `btree_gist`) blocks overlapping assignments for the same employee (FR-104).

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `employee_id` | `uuid` | PK (part 1); NOT NULL; FK → `profiles.id` ON DELETE CASCADE | Employee. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `schedule_id` | `uuid` | NOT NULL; FK → `schedules.id` ON DELETE RESTRICT | Assigned schedule. | `5d0e9b7c-3a21-4f08-b6c4-71e2a9d03b55` |
| `effective_from` | `date` | PK (part 2); NOT NULL | First Manila date the schedule applies. | `2026-10-01` |
| `effective_to` | `date` | NULL allowed; CHECK `effective_to IS NULL OR effective_to >= effective_from` | Last date it applies; NULL = open-ended. | `NULL` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | When the assignment was made. | `2026-09-29 10:14:03+08` |

---

### 5.4 `stations`

**Purpose:** A kiosk QR station (the BHW Office tablet/monitor) with its location, geofence and live health status (FR-108 to FR-111, D-34).

**RLS:** Admin full access. A kiosk account reads only the station where `kiosk_user_id = auth.uid()`. Employees have no direct `SELECT`; active employees get `id`, `name`, `latitude`, `longitude` and the effective radius of active stations through the `SECURITY DEFINER` RPC `get_active_stations()` (used by the mobile pre-scan distance hint), so `kiosk_user_id` and health columns stay hidden. Viewers read nothing directly. `last_seen_at` and `is_online` are written only by `kiosk-heartbeat` and the offline-detection job (service role).

**Retention:** Kept; a station is deactivated (`is_active = false`) instead of deleted because attendance records reference it (ON DELETE RESTRICT).

**Indexes:** unique `kiosk_user_id`; `is_online`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Station ID; used in `/kiosk/[stationId]` and in the QR token `sid`. | `b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42` |
| `name` | `text` | NOT NULL; UNIQUE; CHECK `char_length(name) BETWEEN 2 AND 80` | Name shown on the kiosk and in reports. | `BHW Office – Main Entrance` |
| `latitude` | `numeric(9,6)` | NOT NULL; CHECK `latitude BETWEEN -90 AND 90` | Station latitude (WGS 84). | `6.633012` |
| `longitude` | `numeric(9,6)` | NOT NULL; CHECK `longitude BETWEEN -180 AND 180` | Station longitude (WGS 84). | `124.604871` |
| `radius_m` | `integer` | NULL allowed; CHECK `radius_m IS NULL OR radius_m BETWEEN 10 AND 1000` | Geofence radius in metres (decisions section D step 12). NULL = use `app_settings.geofence_radius_m` (default 100), so a change to the setting applies to every station without its own radius. | `NULL` |
| `is_active` | `boolean` | NOT NULL; DEFAULT `true` | Inactive stations cannot issue tokens; scans return `STATION_INACTIVE`. | `true` |
| `kiosk_user_id` | `uuid` | UNIQUE; FK → `profiles.id` ON DELETE SET NULL | Kiosk account linked to this station (D-03). A trigger checks that the profile has role `kiosk`. | `c2d8f5a1-7e90-4b36-9d1c-0a5e6f3b8d27` |
| `last_seen_at` | `timestamptz` | NULL allowed | Server time of the last heartbeat. | `2026-10-05 07:59:02+08` |
| `is_online` | `boolean` | NOT NULL; DEFAULT `false` | `false` when `last_seen_at < now() − 3 × heartbeat_interval_seconds` (D-34). | `true` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Creation time. | `2026-09-01 09:30:00+08` |
| `updated_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Last change. | `2026-10-05 07:59:02+08` |

> **Backend Developer note:** heartbeat updates of `last_seen_at`/`is_online` are excluded from the audit trigger (only changes to the other columns are audited); otherwise `audit_logs` would grow by 1,440 rows per station per day.

---

### 5.5 `devices`

**Purpose:** Phones bound to employees. Stores only the HMAC hash of the app's installation ID (D-05). At most one non-revoked device per employee, and one hash cannot be active for two employees (D-06). Admin "reset device" sets `revoked_at` (D-07, FR-32).

**RLS:** An employee reads only their own rows. Inserts happen only in `bind-device` (service role); `revoked_at` is set only by the admin RPC `reset_device`. Admin reads all rows (device history, FR-33). No access for viewer or kiosk.

**Retention:** Same as the employee's profile (ON DELETE CASCADE); revoked rows are kept as device history.

**Indexes:** unique partial `(employee_id) WHERE revoked_at IS NULL`; unique partial `(device_id_hash) WHERE revoked_at IS NULL`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Binding ID. | `e3a90c5f-2b17-4d68-8e4a-6f1b0c9d2a73` |
| `employee_id` | `uuid` | NOT NULL; FK → `profiles.id` ON DELETE CASCADE | Owner of the phone. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `device_id_hash` | `text` | NOT NULL; CHECK `device_id_hash ~ '^[0-9a-f]{64}$'` | `HMAC-SHA256(DEVICE_HASH_PEPPER, raw_installation_id)` in lowercase hex. Raw ID is never stored. | `4be1c07a9f3d2e85b6a01c7f9e2d4b38a5c6e7f8091a2b3c4d5e6f708192a3b4` |
| `platform` | `device_platform` | NOT NULL | Phone operating system. | `android` |
| `model` | `text` | NULL allowed; CHECK `char_length(model) <= 100` | Model name from `expo-device`. | `Samsung Galaxy A05` |
| `bound_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | When the phone was bound. | `2026-09-29 18:05:44+08` |
| `revoked_at` | `timestamptz` | NULL allowed; CHECK `revoked_at IS NULL OR revoked_at >= bound_at` | When the admin reset the binding; NULL = active. | `NULL` |

---

### 5.6 `qr_nonces`

**Purpose:** Registry of nonces issued in kiosk QR tokens by `issue-qr-token` (FR-38). A scanned nonce that is not here for that station is rejected with `QR_UNKNOWN` (D-10, step 8).

**RLS:** No client access. Written by `issue-qr-token` and read by `record-attendance` (service role only).

**Retention:** 1 day; hourly pg_cron cleanup deletes rows with `expires_at < now() − interval '1 day'` (FR-147).

**Indexes:** `(station_id, issued_at DESC)`; `expires_at`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `nonce` | `uuid` | PK | Random UUID v4 carried as `n` in the token. | `8c2f4e61-0d9a-4b7e-a3c5-9f1e2d7b6a04` |
| `station_id` | `uuid` | NOT NULL; FK → `stations.id` ON DELETE CASCADE | Station that displayed the QR. | `b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42` |
| `issued_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Server issue time (`iat`). | `2026-10-05 07:52:00+08` |
| `expires_at` | `timestamptz` | NOT NULL; CHECK `expires_at > issued_at` | `issued_at + token_lifetime_seconds` (`exp`). | `2026-10-05 07:52:30+08` |

---

### 5.7 `qr_nonce_uses`

**Purpose:** Records that an employee has used a nonce, so the same QR cannot be used twice by the same user (D-10, FR-49, AC-03). Holds kiosk nonces (from `record-attendance`) and personal-QR nonces (from `record-fallback-scan`, D-12). Inserted in the same transaction as the attendance write; a primary-key conflict returns `QR_REUSED`.

**RLS:** No client access (service role only).

**Retention:** 1 day; deleted by the hourly cleanup with `used_at < now() − interval '1 day'` (FR-147).

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `nonce` | `uuid` | PK (part 1); NOT NULL | Nonce from the scanned kiosk or personal QR. No FK (see section 2, item 8). | `8c2f4e61-0d9a-4b7e-a3c5-9f1e2d7b6a04` |
| `employee_id` | `uuid` | PK (part 2); NOT NULL; FK → `profiles.id` ON DELETE CASCADE | Employee who used it. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `used_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Server time of use; drives cleanup. | `2026-10-05 07:52:14+08` |

---

### 5.8 `attendance_records`

**Purpose:** The official attendance: one row per employee per work date with time-in, time-out, computed status, minutes late and undertime. Source of the DTR (FR-78), reports (FR-92) and dashboard (FR-95).

**RLS:** An employee reads only their own rows. Admin reads all rows. **No client role can insert, update or delete** (FR-61): writes come only from `record-attendance`, `record-fallback-scan` and `device-sync` (service role), the admin RPCs `manual_attendance_entry`, `review_correction_request` and the audited recompute action (`SECURITY DEFINER`), and the end-of-day job. Viewers read only through report RPCs. Kiosks have no access; their recent-scan feed is a Realtime broadcast that carries first name, label and time only (FR-40).

**Retention:** 5 years from `work_date` (FR-150).

**Indexes:** unique `(employee_id, work_date)`; `(work_date, status)`; `station_id`. Added to the `supabase_realtime` publication for the admin dashboard (FR-97).

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Record ID. | `1a7d3e90-4c2b-4f86-b915-0e8c7d6a5b32` |
| `employee_id` | `uuid` | NOT NULL; FK → `profiles.id` ON DELETE RESTRICT; UNIQUE with `work_date` | Employee. RESTRICT protects the 5-year retention. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `work_date` | `date` | NOT NULL | Manila work date (D-13 overnight rule). | `2026-10-05` |
| `time_in` | `timestamptz` | CHECK `status = 'absent' OR time_in IS NOT NULL`; CHECK `status <> 'absent' OR (time_in IS NULL AND time_out IS NULL)` | Server time of time-in. NULL only for `absent`. | `2026-10-05 08:21:37+08` |
| `time_out` | `timestamptz` | CHECK `time_out IS NULL OR time_out > time_in`; CHECK `status <> 'incomplete' OR time_out IS NULL` | Server time of time-out. May fall after midnight (D-13). | `2026-10-05 17:03:12+08` |
| `station_id` | `uuid` | FK → `stations.id` ON DELETE RESTRICT | Station of the scan (or chosen by the admin for fallback, FR-64). NULL for `absent`, manual entries without a station and corrections. | `b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42` |
| `status` | `attendance_status` | NOT NULL | Stored status by D-17 precedence. | `late` |
| `minutes_late` | `integer` | NOT NULL; DEFAULT `0`; CHECK `minutes_late >= 0` | `time_in − start_time` in minutes when past the grace period, else 0 (D-15). | `21` |
| `undertime_minutes` | `integer` | NOT NULL; DEFAULT `0`; CHECK `undertime_minutes >= 0` | `max(0, end_time − time_out)` in minutes (D-16). | `0` |
| `method` | `attendance_method` | NOT NULL | How the record was last written (D-28). Rows inserted as `absent` by the end-of-day job use `qr` with `station_id` and `created_by` NULL (ERD CHECK exemption). | `qr` |
| `notes` | `text` | CHECK `char_length(notes) <= 500`; CHECK `method <> 'manual' OR char_length(btrim(notes)) >= 10` (manual-entry reason, BR-60) | System or admin notes: `Non-working day`, holiday name, `No schedule assigned`, `Official business`, manual-entry reason, fallback note. | `NULL` |
| `created_by` | `uuid` | FK → `profiles.id` ON DELETE SET NULL | Who caused the write: the employee for `qr`, the admin for `fallback_personal_qr`, `manual` and `correction`; NULL for rows inserted by the end-of-day job. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `time_in_scan_id` | `uuid` | FK → `scan_attempts.id` ON DELETE SET NULL | Successful scan attempt that set `time_in`. Becomes NULL after the scan attempt's 1-year retention. | `f04b9e2c-6a1d-4c73-8e50-2b7d9a1c3e68` |
| `time_out_scan_id` | `uuid` | FK → `scan_attempts.id` ON DELETE SET NULL | Successful scan attempt that set `time_out`. | `0d6c3a8f-9e2b-4157-a4d0-7c1e5b9f2a86` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Row creation time. | `2026-10-05 08:21:37+08` |
| `updated_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Last change (time-out, job, correction). | `2026-10-05 17:03:12+08` |

> **Frontend Designer / Developer note:** `method` drives the method badge on Attendance Records, history and the DTR source data (FR-66); `status` maps to the status badge colours in the Visual Reference (`incomplete` uses the "No time-out" colours).

---

### 5.9 `scan_attempts`

**Purpose:** Log of every scan request to `record-attendance`, successful or failed, with location and device data (FR-55). Used for cooldown (D-20), failed-scan review (FR-124), anomaly flags (FR-58) and the Device Health summary (FR-113).

**RLS:** No client writes (service role only). An employee reads only their own rows (`success`, `error_code`, `failure_reason`, `created_at`, station). Admin reads all rows. No access for viewer or kiosk.

**Retention:** 1 year from `created_at`. Selfie files are deleted after `selfie_retention_days` (default 30) and `selfie_path` is then set to NULL.

**Indexes:** `(employee_id, created_at DESC) WHERE success` (cooldown lookup); `(created_at DESC)`; `(station_id, created_at DESC)`; `error_code`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Attempt ID. | `f04b9e2c-6a1d-4c73-8e50-2b7d9a1c3e68` |
| `employee_id` | `uuid` | FK → `profiles.id` ON DELETE SET NULL | Caller; NULL when the JWT was missing or invalid (`AUTH_REQUIRED`). | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `station_id` | `uuid` | FK → `stations.id` ON DELETE SET NULL (`08-erd.md` R-17; stations are deactivated, not deleted, while attendance references them) | Station from the token; NULL when the token could not be read. | `b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42` |
| `success` | `boolean` | NOT NULL; CHECK `success = (error_code IS NULL)` | `true` when a time-in or time-out was recorded. | `true` |
| `error_code` | `text` | CHECK `error_code IS NULL OR error_code IN ('AUTH_REQUIRED','RATE_LIMITED','INVALID_REQUEST','ACCOUNT_NOT_ACTIVE','DEVICE_NOT_BOUND','DEVICE_MISMATCH','QR_INVALID','QR_EXPIRED','QR_UNKNOWN','QR_REUSED','STATION_INACTIVE','GPS_INACCURATE','OUTSIDE_GEOFENCE','COOLDOWN_ACTIVE','ALREADY_COMPLETED','SELFIE_REQUIRED','INTERNAL_ERROR')` | Server error code from section D (see section 3). | `NULL` |
| `failure_reason` | `text` | CHECK `char_length(failure_reason) <= 500` | Plain-English detail for the admin, e.g. measured distance. | `NULL` (failure example: `Outside geofence: 312 m from BHW Office – Main Entrance (limit 100 m)`) |
| `lat` | `numeric(9,6)` | CHECK `lat IS NULL OR lat BETWEEN -90 AND 90` | Phone latitude sent with the scan. | `6.633105` |
| `lng` | `numeric(9,6)` | CHECK `lng IS NULL OR lng BETWEEN -180 AND 180` | Phone longitude sent with the scan. | `124.604790` |
| `accuracy` | `numeric(7,2)` | CHECK `accuracy IS NULL OR accuracy >= 0` | GPS accuracy radius in metres reported by `expo-location`. | `12.50` |
| `device_id_hash` | `text` | CHECK `device_id_hash IS NULL OR device_id_hash ~ '^[0-9a-f]{64}$'` | Hash of the device that sent the scan (same HMAC as `devices`). | `4be1c07a9f3d2e85b6a01c7f9e2d4b38a5c6e7f8091a2b3c4d5e6f708192a3b4` |
| `nonce` | `uuid` | NULL allowed | Nonce from the token, when it could be read. | `8c2f4e61-0d9a-4b7e-a3c5-9f1e2d7b6a04` |
| `selfie_path` | `text` | NULL allowed | Object path in private bucket `selfies` when a selfie was sent (FR-57). | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10/2026-10-05T08-21-37.jpg` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Server time of the attempt (the official scan time). | `2026-10-05 08:21:37+08` |

---

### 5.10 `audit_logs`

**Purpose:** Append-only trail of every change to audited tables (trigger `audit_row_change()`) and of every admin action with a reason (approve, reject, reset device, manual entry, fallback scan, correction review, recompute, erasure) (FR-126, FR-129).

**RLS:** Admin read only. **No role can update or delete** (FR-127): there are no update/delete policies and a `BEFORE UPDATE OR DELETE` trigger raises an exception for everyone except the retention job. Inserts come only from the trigger and `SECURITY DEFINER` functions. Viewers, employees and kiosks have no access (FR-131).

**Retention:** 5 years from `created_at`.

**Indexes:** `(table_name, record_id)`; `(actor_id, created_at DESC)`; `(created_at DESC)`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Entry ID. | `7b2e5d14-8f3a-4c09-9a6e-1d0c4b8f7e23` |
| `actor_id` | `uuid` | NULL allowed (no FK, so entries survive profile deletion) | `auth.uid()` of the user who caused the change; NULL for pg_cron jobs and service-role writes without a user. | `9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08` |
| `action` | `text` | NOT NULL; CHECK `action IN ('insert','update','delete','approve_employee','reject_employee','deactivate_employee','reactivate_employee','reset_device','manual_entry','fallback_scan','review_correction','recompute_attendance','erase_personal_data')` | Row operation (trigger) or named admin action (RPC). | `manual_entry` |
| `table_name` | `text` | NOT NULL | Affected table. | `attendance_records` |
| `record_id` | `text` | NOT NULL | Primary key of the affected row as text (uuid, date, `1`, or `employee_id\|effective_from` for `employee_schedules`). | `1a7d3e90-4c2b-4f86-b915-0e8c7d6a5b32` |
| `old_data` | `jsonb` | NULL allowed | Row before the change (NULL on insert). Encrypted fields shown only as `"[changed]"`/`"[unchanged]"` (FR-130). | `{"time_out": null, "status": "incomplete"}` |
| `new_data` | `jsonb` | NULL allowed | Row after the change (NULL on delete). Named actions add a `"reason"` key. | `{"time_out": "2026-10-03T17:00:00+08:00", "status": "on_time", "method": "manual", "reason": "Kiosk tablet lost power at 16:40; time-out confirmed by BHW coordinator."}` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Server time of the change. | `2026-10-04 09:12:45+08` |

---

### 5.11 `holidays`

**Purpose:** Non-working holidays (national, local and special). No absences are marked on these dates and the DTR shows the holiday name (D-18, D-22, FR-106).

**RLS:** Admin full access. Every authenticated role reads all rows (the mobile app and DTR show holiday names; holiday dates are not personal data).

**Retention:** Kept (needed to rebuild past DTRs and reports).

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `date` | `date` | PK | Holiday date (Manila). | `2026-11-30` |
| `name` | `text` | NOT NULL; CHECK `char_length(name) BETWEEN 2 AND 120` | Name shown on the DTR and reports. | `Bonifacio Day` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | When it was added. | `2026-09-01 09:45:00+08` |

---

### 5.12 `app_settings`

**Purpose:** System-wide settings that the admin can change without redeploying (FR-132, FR-133). It is a **single-row table**: `id` is always `1`, every key from section M of the decisions file is a typed column with its default, and `seed.sql` inserts the one row.

**RLS:** Every authenticated role reads the row (kiosk needs token and heartbeat timing, mobile needs cooldown and selfie flag, reports need office name). Only admin can update. No role can insert or delete.

**Retention:** Single row, never deleted. Every change is audited.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `integer` | PK; DEFAULT `1`; CHECK `id = 1` | Fixed key so only one row can exist. | `1` |
| `geofence_radius_m` | `integer` | NOT NULL; DEFAULT `100`; CHECK `geofence_radius_m BETWEEN 10 AND 1000` | Default geofence radius for stations whose `radius_m` is NULL (BR-37). | `100` |
| `max_gps_accuracy_m` | `integer` | NOT NULL; DEFAULT `50`; CHECK `max_gps_accuracy_m BETWEEN 5 AND 200` | Worst GPS accuracy accepted (`GPS_INACCURATE` above). | `50` |
| `cooldown_minutes` | `integer` | NOT NULL; DEFAULT `5`; CHECK `cooldown_minutes BETWEEN 1 AND 60` | Minutes after a successful scan before another is accepted (D-20). | `5` |
| `token_lifetime_seconds` | `integer` | NOT NULL; DEFAULT `30`; CHECK `token_lifetime_seconds BETWEEN 15 AND 120` | Kiosk and personal QR lifetime (D-09). | `30` |
| `token_refresh_seconds` | `integer` | NOT NULL; DEFAULT `15`; CHECK `token_refresh_seconds BETWEEN 5 AND 60`; CHECK `token_refresh_seconds < token_lifetime_seconds` | How often the kiosk and My QR screen fetch a new token, so tokens overlap. | `15` |
| `selfie_required` | `boolean` | NOT NULL; DEFAULT `false` | When true, scans without a selfie fail with `SELFIE_REQUIRED` (FR-57). | `false` |
| `selfie_retention_days` | `integer` | NOT NULL; DEFAULT `30`; CHECK `selfie_retention_days BETWEEN 1 AND 365` | Days before selfie files are deleted (D-32). | `30` |
| `overnight_cutoff_hour` | `integer` | NOT NULL; DEFAULT `4`; CHECK `overnight_cutoff_hour BETWEEN 0 AND 6` | Scans before this Manila hour close the previous day's open record (D-13). The end-of-day job runs at this hour + 5 minutes (D-21). | `4` |
| `correction_window_days` | `integer` | NOT NULL; DEFAULT `5`; CHECK `correction_window_days BETWEEN 0 AND 15` | Days into the new month that previous-month corrections are still allowed (D-26). | `5` |
| `heartbeat_interval_seconds` | `integer` | NOT NULL; DEFAULT `60`; CHECK `heartbeat_interval_seconds BETWEEN 30 AND 300` | Kiosk heartbeat interval; offline after 3 missed intervals (D-34). | `60` |
| `dtr_fill_break_times` | `boolean` | NOT NULL; DEFAULT `false` | When true, unscanned lunch cells on the DTR show the schedule's break times (D-22). | `false` |
| `office_name` | `text` | NOT NULL; DEFAULT `'Barangay Kalawag II Health Workers Office'`; CHECK `char_length(office_name) BETWEEN 2 AND 150` | Report, DTR and kiosk header. | `Barangay Kalawag II Health Workers Office` |
| `office_address` | `text` | NOT NULL; DEFAULT `'Barangay Kalawag II, Isulan, Sultan Kudarat'`; CHECK `char_length(office_address) BETWEEN 2 AND 200` | Report and DTR header address. | `Barangay Kalawag II, Isulan, Sultan Kudarat` |
| `updated_by` | `uuid` | FK → `profiles.id` ON DELETE SET NULL | Admin who last changed a setting. | `9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08` |
| `updated_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Last change. | `2026-10-01 08:30:00+08` |

> **System Administrator note:** changing `overnight_cutoff_hour` must also reschedule the end-of-day pg_cron job (default `5 20 * * *` UTC = 04:05 Manila). The Settings save action does this through an admin RPC so the two never drift apart.

---

### 5.13 `correction_requests`

**Purpose:** Employee requests to fix a day's attendance (missing time-in, missing time-out, wrong time, official business) with the admin's review (FR-68 to FR-77, D-25 to D-28). Approval updates `attendance_records` in the same transaction (FR-74).

**RLS:** An employee reads only their own requests, inserts only for themselves with status `pending` (eligibility checked by a `BEFORE INSERT` trigger, D-26), and may only change their own `pending` request to `cancelled`. Admin reads all and reviews only through `review_correction_request`. No access for viewer or kiosk.

**Retention:** 5 years from `created_at`; the attachment object is deleted together with the row.

**Indexes:** unique partial `(employee_id, work_date) WHERE status = 'pending'` (one pending request per day); `(status, created_at)`; `attendance_record_id`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Request ID. | `2c9e7f04-1b3d-4a68-9f25-8e0d6c4b1a97` |
| `employee_id` | `uuid` | NOT NULL; FK → `profiles.id` ON DELETE RESTRICT | Employee who filed it. | `6e1f8a3b-4c27-4d90-a5b8-3f2e1d0c9b46` |
| `attendance_record_id` | `uuid` | FK → `attendance_records.id` ON DELETE SET NULL | Record being corrected; NULL when no record exists yet for that date. | `9d4b2a7e-5c18-4f03-b6e9-0a7c3d8e1f25` |
| `work_date` | `date` | NOT NULL | Manila work date to correct (eligibility D-26). | `2026-10-02` |
| `type` | `correction_type` | NOT NULL | Kind of correction (D-25). | `missing_time_out` |
| `requested_time_in` | `timestamptz` | CHECK `type <> 'missing_time_in' OR requested_time_in IS NOT NULL` | Requested time-in (Manila date + time entered in the form). | `NULL` |
| `requested_time_out` | `timestamptz` | CHECK `type <> 'missing_time_out' OR requested_time_out IS NOT NULL`; CHECK `requested_time_in IS NULL OR requested_time_out IS NULL OR requested_time_out > requested_time_in`; CHECK `type <> 'wrong_time' OR requested_time_in IS NOT NULL OR requested_time_out IS NOT NULL` | Requested time-out. For `official_business` both may be blank (D-28). | `2026-10-02 17:05:00+08` |
| `reason` | `text` | NOT NULL; CHECK `char_length(btrim(reason)) BETWEEN 10 AND 1000` | Employee's explanation. | `Nag-low batt ang cellphone ko bago mag-time out. Phone battery died before I could scan out at 5:05 PM.` |
| `attachment_url` | `text` | NULL allowed | Object path in private bucket `correction-attachments` (image or PDF, at most 5 MB, D-26). | `6e1f8a3b-4c27-4d90-a5b8-3f2e1d0c9b46/2c9e7f04-logbook.jpg` |
| `status` | `correction_status` | NOT NULL; DEFAULT `'pending'` | Workflow state. | `approved` |
| `reviewed_by` | `uuid` | FK → `profiles.id` ON DELETE SET NULL (`08-erd.md` R-21: a deleted admin account must not block the 5-year correction records) | Admin who approved or rejected. | `9a1c7d22-0b3e-4c55-8f61-2e4d9b7a3c08` |
| `reviewed_at` | `timestamptz` | CHECK `(status IN ('approved','rejected')) = (reviewed_at IS NOT NULL)` | Review time. | `2026-10-03 09:40:18+08` |
| `remarks` | `text` | CHECK `status <> 'rejected' OR char_length(btrim(remarks)) >= 10` (BR-70); CHECK `char_length(remarks) <= 500` | Admin remarks; required on rejection (FR-74). | `Confirmed with the BHW office logbook.` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Filing time. | `2026-10-02 20:11:52+08` |
| `updated_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Last change (cancel or review). | `2026-10-03 09:40:18+08` |

---

### 5.14 `kiosk_heartbeats`

**Purpose:** History of kiosk heartbeats sent every `heartbeat_interval_seconds` (FR-109, D-34). The latest row per station feeds the Device Health page; the 30-day history feeds FR-112.

**RLS:** Inserted only by `kiosk-heartbeat` (service role), which takes the station from the kiosk's own `stations.kiosk_user_id`, so a kiosk cannot write for another station. Admin read only. No access for employee or viewer.

**Retention:** 30 days (FR-150).

**Indexes:** `(station_id, created_at DESC)`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Heartbeat ID. | `5f8a1c3e-9d2b-4e70-a6c4-7b0e3d9f1a58` |
| `station_id` | `uuid` | NOT NULL; FK → `stations.id` ON DELETE CASCADE | Reporting station. | `b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42` |
| `app_version` | `text` | NOT NULL; CHECK `char_length(app_version) <= 40` | Web app build running on the kiosk. | `1.0.3+42` |
| `clock_drift_ms` | `integer` | NOT NULL | Kiosk `Date.now()` minus server time in milliseconds; warning when the absolute value is above 30,000 (D-34). | `-1240` |
| `last_token_at` | `timestamptz` | NULL allowed | Issue time of the last QR token the kiosk received. | `2026-10-05 07:58:45+08` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Server receive time. | `2026-10-05 07:59:02+08` |

---

### 5.15 `error_logs`

**Purpose:** Central error log for Edge Functions, kiosk, mobile app and web (FR-120, FR-121), plus kiosk offline transitions (D-34) and failed scheduled jobs (FR-151).

**RLS:** No direct client inserts: clients call `log-error`, which validates, rate-limits and strips secrets from `context` (FR-122) before inserting with the service role. Admin read only. No access for employee, viewer or kiosk.

**Retention:** 180 days (FR-150).

**Indexes:** `(created_at DESC)`; `(severity, created_at DESC)`; `source`.

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Entry ID. | `a3d7e9b1-2c40-4f85-9e16-0b8c5d2f7a39` |
| `source` | `error_source` | NOT NULL | Where the error happened. | `kiosk` |
| `severity` | `error_severity` | NOT NULL | Seriousness. | `critical` |
| `message` | `text` | NOT NULL; CHECK `char_length(message) BETWEEN 1 AND 2000` | Short human-readable message. | `Station "BHW Office – Main Entrance" went offline (no heartbeat for 3 minutes).` |
| `context` | `jsonb` | NOT NULL; DEFAULT `'{}'::jsonb` | Structured details with secrets, tokens, raw device IDs and decrypted fields removed (function name, app version, route, station ID, stack trace). | `{"station_id": "b7e41a09-6c2d-4e83-a5f0-1d9c8b3e7a42", "last_seen_at": "2026-10-05T12:31:02+08:00", "detected_by": "kiosk_offline_job"}` |
| `user_id` | `uuid` | FK → `profiles.id` ON DELETE SET NULL | User whose action caused the error, when known. | `NULL` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Server time recorded. | `2026-10-05 12:34:00+08` |

---

### 5.16 `notifications`

**Purpose:** In-app messages shown on web `/me` and in the mobile app with an unread count (D-33, FR-142, FR-144, FR-145). Email copies are sent separately by `send-notification-email` when configured.

**RLS:** A user reads only rows where `user_id = auth.uid()` and may update only `read_at` on their own rows. Inserts come only from `SECURITY DEFINER` functions, triggers and Edge Functions. No client delete.

**Retention:** 1 year from `created_at` (D-32), deleted by the daily retention job (FR-150).

**Indexes:** `(user_id, created_at DESC)`; partial `(user_id) WHERE read_at IS NULL` (unread count).

| Column | Type | Constraint | Description | Sample |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK; DEFAULT `gen_random_uuid()` | Notification ID. | `c8e2a5f9-7b13-4d60-8a94-2f1d0e6b3c75` |
| `user_id` | `uuid` | NOT NULL; FK → `profiles.id` ON DELETE CASCADE | Recipient. | `6e1f8a3b-4c27-4d90-a5b8-3f2e1d0c9b46` |
| `title` | `text` | NOT NULL; CHECK `char_length(title) BETWEEN 1 AND 120` | Short heading. | `Correction request approved` |
| `body` | `text` | NOT NULL; CHECK `char_length(body) BETWEEN 1 AND 1000` | Message text (includes the admin's remarks when relevant). | `Your missing time-out request for October 2, 2026 was approved. Remarks: Confirmed with the BHW office logbook.` |
| `kind` | `notification_kind` | NOT NULL | Category; the apps use it to pick the icon and link. The first six values go to employees, the last four to admins (FR-144, FR-145; see section 3). | `correction_approved` |
| `read_at` | `timestamptz` | NULL allowed | When the user marked it read; NULL = unread. | `NULL` |
| `created_at` | `timestamptz` | NOT NULL; DEFAULT `now()` | Creation time. | `2026-10-03 09:40:18+08` |

---

## 6. Storage buckets referenced by columns

| Bucket (private, D-31) | Referenced by | Path pattern | Size / type | Retention |
| --- | --- | --- | --- | --- |
| `profile-photos` | `profiles.photo_url` | `<user_id>/<file>` | JPEG, PNG, WebP, at most 5 MB (FR-06) | Until replaced, erased (FR-20) or the profile is deleted |
| `selfies` | `scan_attempts.selfie_path` | `<employee_id>/<ISO timestamp>.jpg` | JPEG, at most 5 MB | `selfie_retention_days` (default 30) |
| `correction-attachments` | `correction_requests.attachment_url` | `<employee_id>/<request_id>-<file>` | Image or PDF, at most 5 MB (D-26) | Same as the request (5 years) |

---

## 7. Views and RPC return types

All functions below are `SECURITY DEFINER` (or `SECURITY INVOKER` where noted), check the caller's role inside the function (FR-141), and compute everything from `attendance_records`, `employee_schedules`, `schedules`, `holidays` and `app_settings` at call time (no stored copies, FR-85, FR-92). Dates and times in results are Manila.

### 7.1 `dtr_month(p_employee_id uuid, p_year int, p_month int)` – CSC Form No. 48 rows

Returns `SETOF dtr_row` (composite type): **always 31 rows**, one per day number, matching the 31 printed lines of CSC Form No. 48 (FR-78). Days that do not exist in the month (for example 30 and 31 in February) have `work_date = NULL` and all other columns empty.

| Column | Type | Description | Sample |
| --- | --- | --- | --- |
| `day` | `smallint` | Day number 1–31. | `5` |
| `work_date` | `date` | Calendar date, NULL for non-existent days. | `2026-10-05` |
| `am_arrival` | `time` | `time_in` (Manila) when before `break_start` (D-22). | `08:21` |
| `am_departure` | `time` | `time_out` when not after `break_end`; otherwise the schedule's `break_start` only if `dtr_fill_break_times` is on AND `time_in < break_start` AND `time_out > break_end` (BR-74), else NULL. | `NULL` |
| `pm_arrival` | `time` | `time_in` when at or after `break_start`; otherwise `break_end` only if `dtr_fill_break_times` is on AND `time_in < break_start` AND `time_out > break_end` (BR-74), else NULL. | `NULL` |
| `pm_departure` | `time` | `time_out` (Manila) when after `break_end`. | `17:03` |
| `undertime_hours` | `smallint` | `(minutes_late + undertime_minutes) / 60`; for an absent work day the full scheduled minutes (end − start − break) / 60 (D-23). | `0` |
| `undertime_minutes` | `smallint` | Remainder minutes 0–59 of the same total. | `21` |
| `remark` | `text` | `Saturday`, `Sunday`, holiday name, `Absent`, `No time-out`, `Official business`, `Non-working day`, `No schedule assigned`, or NULL on a normal day. | `NULL` |
| `status` | `attendance_status` | Stored status, NULL when no record (used for badges on screen, not printed). | `late` |
| `method` | `attendance_method` | Record method, NULL when no record (FR-66 source-data badge). | `qr` |

Example of an absent work day under the 08:00–17:00 schedule with a 12:00–13:00 break: all four time cells NULL, `undertime_hours = 8`, `undertime_minutes = 0`, `remark = 'Absent'`.

### 7.2 `get_dtr(p_employee_id uuid, p_year int, p_month int)` and `get_dtr_batch(p_year int, p_month int)`

`get_dtr` returns one `jsonb` document; admin may request any employee, an employee only their own ID (FR-84). `get_dtr_batch` (admin only, FR-83) returns a `jsonb` array of the same document for every employee who was active during the month, ordered by `full_name`.

| Key | Type | Description | Sample |
| --- | --- | --- | --- |
| `employee.id` | `uuid` | Employee ID. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `employee.full_name` | `text` | Name printed on the form. | `Maria Luz D. Santos` |
| `employee.bhw_id_number` | `text` | BHW ID number. | `BHW-KII-2021-014` |
| `period.year` / `period.month` | `int` | Requested month. | `2026` / `10` |
| `period.label` | `text` | Printed month label. | `October 2026` |
| `office.name` / `office.address` | `text` | From `app_settings` (FR-134). | `Barangay Kalawag II Health Workers Office` |
| `office_hours.regular_days` | `text` | "Regular days" line built from the schedule in effect (D-24). | `Mon–Fri, 08:00–12:00 / 13:00–17:00` |
| `office_hours.saturdays` | `text` | "Saturdays" line; empty when Saturday (6) is not a work day. | `""` |
| `rows` | `dtr_row[]` | The 31 rows of 7.1. | see 7.1 |
| `totals.undertime_total_minutes` | `int` | Sum of daily undertime in minutes. | `141` |
| `totals.undertime_hours` / `totals.undertime_minutes` | `int` | Total split into hours and 0–59 minutes, printed on the TOTAL line (D-23). | `2` / `21` |
| `totals.days_present` | `int` | Days with a time-in (on_time, late, undertime, incomplete). | `20` |
| `totals.days_absent` | `int` | Days with status `absent`. | `1` |
| `totals.days_late` / `totals.days_undertime` / `totals.days_incomplete` | `int` | Counts by stored status. | `3` / `1` / `0` |
| `certification` | `text` | Fixed CSC certification text from D-24. | `I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.` |
| `verified_label` | `text` | Fixed line printed above the in-charge signature (D-24). | `Verified as to the prescribed office hours:` |
| `generated_at` | `timestamptz` | Server time of generation. | `2026-11-02 08:15:00+08` |

### 7.3 `get_daily_summary(p_date date, p_area text DEFAULT NULL, p_status attendance_status DEFAULT NULL)`

Admin and viewer (FR-86, FR-93). Returns `TABLE` with one row per active employee for the date (employees with no record yet have `status = NULL`). Report totals are counts of these same rows grouped by `status`, so they always match the raw records (FR-92, AC-06).

| Column | Type | Description | Sample |
| --- | --- | --- | --- |
| `employee_id` | `uuid` | Employee. | `3f6b2c1e-8a4d-4f7e-9b21-5c0d7e8a9f10` |
| `full_name` | `text` | Name. | `Maria Luz D. Santos` |
| `bhw_id_number` | `text` | BHW ID. | `BHW-KII-2021-014` |
| `area` | `text` | Purok/area. | `Purok Malipayon` |
| `work_date` | `date` | The requested date. | `2026-10-05` |
| `time_in` | `timestamptz` | Time-in or NULL. | `2026-10-05 08:21:37+08` |
| `time_out` | `timestamptz` | Time-out or NULL. | `2026-10-05 17:03:12+08` |
| `status` | `attendance_status` | Stored status; NULL = no record yet. | `late` |
| `minutes_late` | `integer` | From the record (0 when none). | `21` |
| `undertime_minutes` | `integer` | From the record (0 when none). | `0` |
| `method` | `attendance_method` | Record method or NULL. | `qr` |
| `station_name` | `text` | Station name or NULL. | `BHW Office – Main Entrance` |

### 7.4 `get_weekly_summary(p_week_start date, p_area text DEFAULT NULL)`

Admin and viewer (FR-87). `p_week_start` must be a Monday; the week is Monday–Sunday Manila. Returns `TABLE` with one row per employee. Per-day counts for the stacked bar chart (FR-96) are counts of each position of `daily_status` across the rows.

| Column | Type | Description | Sample |
| --- | --- | --- | --- |
| `employee_id` | `uuid` | Employee. | `6e1f8a3b-4c27-4d90-a5b8-3f2e1d0c9b46` |
| `full_name` | `text` | Name. | `Rowena P. Dela Cruz` |
| `area` | `text` | Purok/area. | `Purok Bagong Silang` |
| `week_start` / `week_end` | `date` | Monday and Sunday of the week. | `2026-10-05` / `2026-10-11` |
| `on_time_days` | `integer` | Days with status `on_time`. | `3` |
| `late_days` | `integer` | Days with status `late`. | `1` |
| `undertime_days` | `integer` | Days with status `undertime`. | `0` |
| `absent_days` | `integer` | Days with status `absent`. | `1` |
| `incomplete_days` | `integer` | Days with status `incomplete`. | `0` |
| `total_minutes_late` | `integer` | Sum of `minutes_late`. | `12` |
| `total_undertime_minutes` | `integer` | Sum of `undertime_minutes`. | `0` |
| `daily_status` | `attendance_status[]` | 7 elements Monday→Sunday; NULL where no record. | `{on_time,late,on_time,absent,on_time,NULL,NULL}` |

### 7.5 `get_monthly_summary(p_year int, p_month int, p_area text DEFAULT NULL)`

Admin and viewer (FR-88). Returns `TABLE` with one row per employee active during the month.

| Column | Type | Description | Sample |
| --- | --- | --- | --- |
| `employee_id` | `uuid` | Employee. | `4a8c2e6f-1d3b-4f79-b0e5-9c7a2d4f6e13` |
| `full_name` | `text` | Name. | `Norhaya K. Mamalinta` |
| `bhw_id_number` | `text` | BHW ID. | `BHW-KII-2023-031` |
| `area` | `text` | Purok/area. | `Purok Masagana` |
| `scheduled_work_days` | `integer` | Work days in the month by schedule, minus holidays. | `21` |
| `days_present` | `integer` | Days with a time-in (on_time + late + undertime + incomplete). | `20` |
| `on_time_days` / `late_days` / `undertime_days` / `absent_days` / `incomplete_days` | `integer` | Counts by stored status. | `16` / `3` / `1` / `1` / `0` |
| `total_minutes_late` | `integer` | Sum of `minutes_late`. | `47` |
| `total_undertime_minutes` | `integer` | Sum of `undertime_minutes`. | `30` |

### 7.6 Other RPC results

| Function | Callers | Returns |
| --- | --- | --- |
| `get_employee_history(p_employee_id uuid, p_from date, p_to date)` | Admin; employee for own ID only | `TABLE` of `attendance_records` columns (`id`, `work_date`, `time_in`, `time_out`, `status`, `minutes_late`, `undertime_minutes`, `method`, `notes`) plus `station_name text` and `pending_correction boolean`, newest first. |
| `get_dashboard_today()` | Admin; viewer (FR-101, without personal details) | One row: `work_date date`, `total_employees int` (active employees), `present_count int` (records with time-in today), `on_time_count int`, `late_count int`, `undertime_count int`, `incomplete_count int`, `absent_count int` (records with status `absent` for today; normally 0 before the 04:05 end-of-day job), `no_record_yet_count int` (active employees scheduled today, not a holiday, with no record yet; BR-86), `pending_registrations int`, `pending_corrections int`, `offline_stations int`, `critical_errors_24h int`. Admin-only counts (`pending_*`, `offline_stations`, `critical_errors_24h`) are 0 for viewers. |
| `get_profile_private(p_id uuid)` | Owner and admin only (D-29) | One row: `id uuid`, `contact_number text`, `address text` (decrypted with the Vault key). |
| `get_active_stations()` | Active employee, admin | `TABLE (id uuid, name text, latitude numeric(9,6), longitude numeric(9,6), radius_m integer)` where `radius_m = coalesce(stations.radius_m, app_settings.geofence_radius_m)`, active stations only. |
| `manila_today()` | Any (`SECURITY INVOKER`) | `date` – current Manila date. |
| `compute_attendance_status(...)` | Internal | Composite `(status attendance_status, minutes_late integer, undertime_minutes integer)` following D-15 to D-18. |
| `haversine_distance_m(lat1, lng1, lat2, lng2 numeric)` | Internal | `double precision` metres. |

> **Backend Developer note:** the `device-sync` contract (FR-116, FR-117) needs no new columns: a fingerprint terminal is registered as a `stations` row, each event writes one `scan_attempts` row whose `nonce` holds the terminal's event ID (checked before insert for idempotency), and the resulting `attendance_records` row references that scan through `time_in_scan_id` / `time_out_scan_id`.
>
> **Frontend Designer / Developer note:** the DTR page renders the 31 `rows` exactly in order and prints `totals.undertime_hours` / `totals.undertime_minutes` on the TOTAL line; report pages compute their totals by counting the rows they display, never by calling a second function, so printed totals always match the table (AC-06, AC-09).
