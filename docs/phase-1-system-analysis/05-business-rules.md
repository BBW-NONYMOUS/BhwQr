> **Role speaking: System Analyst**

# 05 – Business Rules

This document lists the business rules (BR-01, BR-02, ...) that the database functions, Edge Functions, web portal and mobile app must apply in the same way. Each rule gives the formula or condition, a worked example with real Asia/Manila times, and its source: a binding decision in [`00-assumptions-and-decisions.md`](./00-assumptions-and-decisions.md) (D-xx) and/or a functional requirement in [`02-functional-requirements.md`](./02-functional-requirements.md) (FR-xx).

**How to read this document**

- All dates and times are **Asia/Manila (UTC+08:00, no daylight saving time)**. "Server time" means the database / Edge Function clock.
- The **reference schedule** used in the examples is the seed schedule: **Mon–Fri, 08:00–17:00, grace 15 minutes, break 12:00–13:00**. All other `app_settings` values are the defaults in section M of the decisions file.
- Example employees are fictional BHWs: Maria Santos, Jose Dela Cruz and Ana Reyes.
- When a rule and an example disagree, the rule wins. When this document and the decisions file disagree, the decisions file wins.
- Text inside braces in a message, such as `{next_time}`, is a value that the app fills in at run time.

## Rule index

| # | Section | BR range | Count |
| --- | --- | --- | --- |
| 1 | General time rules | BR-01 – BR-04 | 4 |
| 2 | Registration and account status | BR-05 – BR-16 | 12 |
| 3 | Roles and access | BR-17 – BR-19 | 3 |
| 4 | Device binding and reset | BR-20 – BR-25 | 6 |
| 5 | Kiosk QR token | BR-26 – BR-33 | 8 |
| 6 | Scan validation | BR-34 – BR-42 | 9 |
| 7 | Attendance decision and status | BR-43 – BR-54 | 12 |
| 8 | End-of-day job and forgotten time-out | BR-55 – BR-57 | 3 |
| 9 | Fallback and manual entry | BR-58 – BR-62 | 5 |
| 10 | Correction requests | BR-63 – BR-71 | 9 |
| 11 | DTR (CSC Form No. 48) | BR-72 – BR-80 | 9 |
| 12 | Reports and dashboard counts | BR-81 – BR-88 | 8 |
| 13 | Kiosk health and device sync | BR-89 – BR-92 | 4 |
| 14 | Security, privacy, audit and retention | BR-93 – BR-98 | 6 |
| 15 | Error-code catalog | Tables E-1 to E-3 | 39 codes |

---

## 1. General time rules

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-01 | All attendance logic uses Asia/Manila time. | Timestamps are stored as `timestamptz` (UTC inside the database). Every date or time comparison (work date, start time, grace, end time, holidays, report periods, DTR month) first converts to `Asia/Manila`. `manila_today()` returns the current Manila date. | A scan stored as `2026-11-09 23:55:00+00` (UTC) is Manila **Tuesday 2026-11-10 07:55**, so it belongs to work date 2026-11-10, not 2026-11-09. | FR-114, FR-92; development.md "Timezone" |
| BR-02 | Only server time counts. | Time-in, time-out, token `iat`/`exp`, cooldown and status use `now()` on the server. The phone clock and the kiosk tablet clock are never used for attendance. The kiosk Manila clock is drawn from server time plus the measured offset. | Maria's phone clock is set 10 minutes slow and shows 07:50. The server receives her scan at 08:00:12, so her time-in is **08:00**. | FR-114, FR-39; D-34 |
| BR-03 | Lateness and undertime are computed at minute precision. | Seconds are dropped (truncated) from `time_in` and `time_out` before comparing them with schedule times, so the computed minutes always match the HH:mm values printed on reports and the DTR. The stored timestamps keep their seconds. | Time-in 08:15:59 is treated as 08:15 → on time. Time-in 08:16:00 → late. Time-out 16:59:40 is treated as 16:59 → 1 minute undertime. | FR-53, FR-80, FR-92 |
| BR-04 | Settings take effect on the next request. | Edge Functions and SQL functions read `app_settings` (row `id = 1`) on each call. A changed value applies to the next scan, token or job run without redeploying. Past records are not changed. | The admin changes `cooldown_minutes` from 5 to 3 at 10:00. A scan at 10:01 uses 3 minutes. | FR-132, FR-133 |

---

## 2. Registration and account status

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-05 | Only BHW employees register themselves. | `/register` always creates role `employee` with status `pending`. A registrant cannot choose a role or status. Admin, kiosk and viewer accounts are created by an admin (or `seed.sql`) and start `active`. | Jose registers on 2026-11-02 at 19:20. His profile is created as `employee` / `pending`. | D-01, D-02; FR-05, FR-09 |
| BR-06 | The BHW ID number is unique. | Leading and trailing spaces are removed, the value is stored in upper case, and uniqueness is checked case-insensitively across all profiles (including `inactive` and `rejected` ones until they are deleted). Error `BHW_ID_TAKEN`. | Ana enters `bhw-2026-014`; it is saved as `BHW-2026-014`. Another person entering `BHW-2026-014 ` is rejected with `BHW_ID_TAKEN`. | FR-02 |
| BR-07 | The email address is unique. | Emails are trimmed, compared in lower case, and must be unique in Supabase Auth and `profiles.email`. Error `EMAIL_TAKEN`. | `Maria.Santos@gmail.com` and `maria.santos@gmail.com` are the same address; the second registration is rejected. | FR-02; D-04 |
| BR-08 | Data Privacy consent is required. | The consent checkbox is unticked by default and must be ticked before submit. The server sets `profiles.consent_at = now()`; a registration without consent is rejected with `CONSENT_REQUIRED`. Consent text links to `/privacy`. | Jose ticks consent and submits at 19:20:05 on 2026-11-02; `consent_at = 2026-11-02 19:20:05`. | FR-03, FR-10; RA 10173 |
| BR-09 | Profile photo: type and size limits. | Allowed types: **JPEG, PNG, WebP** (checked by MIME type and file extension). Maximum size: **5 MB**. Stored in the private `profile-photos` bucket; the profile stores only the storage path; viewed through signed URLs (≤ 60 min). Errors `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`. | A 1.6 MB `photo.jpg` is accepted. A 6.1 MB JPEG is rejected with `FILE_TOO_LARGE`; a `.heic` file is rejected with `FILE_TYPE_NOT_ALLOWED`. | FR-06; D-31 |
| BR-10 | Field formats. | Full name 2–100 characters; purok/area required; contact number Philippine mobile format `09XXXXXXXXX` (11 digits); address optional; password at least 8 characters. Contact number and address are encrypted at rest (BR-93). | `0917 123 4567` is normalised to `09171234567` and accepted; `+639171234567` is normalised to `09171234567`; `0812345678` is rejected. | FR-02, FR-07; D-29 |
| BR-11 | Email must be verified before review. | A `pending` registration appears in Pending Approvals only after Supabase Auth confirms the email. | Jose registers at 19:20 and clicks the verification link at 19:31; he appears in the admin's list from 19:31. | D-04; FR-04, FR-21 |
| BR-12 | Approval requires a schedule. | The admin must pick a schedule and an effective-from date. Approval sets `status = 'active'`, `approved_by`, `approved_at`, and inserts the `employee_schedules` row in one transaction. Error `SCHEDULE_REQUIRED`. | On 2026-11-03 at 09:12 the admin approves Jose with "Mon–Fri 08:00–17:00" effective 2026-11-04. | FR-22; D-19 |
| BR-13 | Rejection requires a reason. | `rejection_reason` is required (at least 10 characters) and is shown to the registrant on `/rejected`, in-app and by email. Error `REASON_REQUIRED`. | "BHW ID number not found in the barangay roster." | FR-23, FR-24; D-33 |
| BR-14 | Account status changes follow the state table in section 2.1. | Any change not listed in the table is refused by the admin RPCs. Every change is audited with the acting admin. | Trying to change a `rejected` profile directly to `active` is refused. | D-01; FR-15, FR-22, FR-23, FR-26 |
| BR-15 | Rejected registrations are deleted after 90 days. | A rejected profile (and its auth user and photo) is deleted 90 days after `rejected` is set. The admin may delete it earlier when the person asks, so they can register again with corrected data. The deletion is audited. | Rejected on 2026-11-05 → deleted by the daily cleanup job on 2027-02-03 (90 days later). | D-32; FR-150 |
| BR-16 | Only an `active` employee can use attendance features. | `pending`, `rejected` and `inactive` users may log in but see only the status screen (web `/pending`, `/rejected`, deactivated notice; mobile Blocked screen) and logout. All Edge Functions return `ACCOUNT_NOT_ACTIVE` for them. | Jose logs in to the app on 2026-11-03 at 07:30 before approval → Blocked screen "Waiting for approval". | D-01; FR-08, FR-28, FR-34; AC-01 |

### 2.1 Account status state table

| From | Event | To | Who | Conditions | Effects |
| --- | --- | --- | --- | --- | --- |
| (none) | Registration submitted | `pending` | Registrant | Valid form, consent ticked, unique BHW ID and email | Profile created; verification email sent; not listed until verified |
| `pending` | Approve | `active` | Admin | Email verified; schedule and effective-from chosen | `approved_by`, `approved_at` set; schedule assigned; notification + email; audited |
| `pending` | Reject | `rejected` | Admin | Reason ≥ 10 characters | `rejection_reason` set; notification + email; audited |
| `active` | Deactivate | `inactive` | Admin | Reason ≥ 10 characters | Cannot scan, bind a device or show a personal QR; not marked absent by the end-of-day job; device binding kept; audited |
| `inactive` | Reactivate | `active` | Admin | None | Can scan again from the next request; audited |
| `rejected` | Retention expiry or deletion on request | (deleted) | System / Admin | 90 days after rejection, or earlier on the person's request | Profile, auth user and photo deleted; audit entry kept |

Not allowed: any status → `pending`; `rejected` → `active` or `inactive`; `pending` → `inactive`. Admin, kiosk and viewer accounts move only between `active` and `inactive`.

---

## 3. Roles and access

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-17 | Each role may do only what the permission table in section 3.1 allows. | Enforced in three places: RLS on every table, Next.js middleware on every protected route, and a role/status check inside every Edge Function and RPC. | A viewer opening `/admin/employees` is redirected to the viewer dashboard; calling `approve_employee` returns `FORBIDDEN`. | D-01, D-03; FR-137 – FR-139 |
| BR-18 | The server, not the screen, decides. | Hiding a button is never the only protection. Every Edge Function and RPC re-checks the caller's role and status on each call. | A kiosk account calling `record-attendance` directly receives `ACCOUNT_NOT_ACTIVE` (403, section D step 4). | FR-141 |
| BR-19 | Attendance rows are written only by trusted server code. | Inserts and updates to `attendance_records` happen only through `record-attendance`, `record-fallback-scan`, `device-sync`, `manual_attendance_entry`, `review_correction_request` (approve), the admin "recompute" RPC and the end-of-day job. Direct client writes are denied by RLS for every role, including admin. | An admin using the Supabase client to `update attendance_records set time_in = ...` gets an RLS error; the admin must use manual entry with a reason. | FR-61; development.md "Rules" |

### 3.1 Role permission summary

| Capability | admin | employee | kiosk | viewer |
| --- | --- | --- | --- | --- |
| Register on `/register` | No (created by admin) | Yes (self, becomes `pending`) | No | No |
| Approve / reject registrations | Yes | No | No | No |
| Manage employees, schedules, holidays, stations, settings | Yes | No | No | No |
| See decrypted contact number and address | Yes (all) | Own only | No | No |
| Reset a device | Yes | No | No | No |
| Bind own phone, scan kiosk QR, show personal QR | No | Yes (when `active`) | No | No |
| Issue kiosk QR tokens, send heartbeats | No | No | Yes (own station only) | No |
| Read recent-scan feed (first name, time-in/out, time) | Yes (all stations) | No | Own station only | No |
| Fallback scan and manual entry | Yes | No | No | No |
| View attendance records | All | Own only | No | Report views only (no locations) |
| File / cancel correction requests | No | Own, while `pending` | No | No |
| Approve / reject correction requests | Yes | No | No | No |
| View / download DTR | All employees, single or batch | Own only | No | No |
| View reports and dashboard | Yes (full) | No (own Home/History only) | No | Read-only, no action buttons, no contact data |
| Export reports to CSV/PDF | Yes | No | No | Yes (no contact data) |
| Error Logs and Audit Log pages | Yes (read; audit is append-only) | No | No | No |
| Send errors to `log-error` | Yes | Yes | Yes | Yes |

---

## 4. Device binding and reset

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-20 | The phone is identified by a hashed installation ID. | On first launch the app creates a random UUID and keeps it in SecureStore. The server stores only `device_id_hash = HMAC-SHA256(DEVICE_HASH_PEPPER, raw_id)` in hex. The raw ID travels only over TLS and is never stored or logged. | Raw ID `3f1c...a9` → stored hash `7b0e...41` (64 hex characters). | D-05; FR-27, FR-29 |
| BR-21 | One active device per employee, one employee per device. | At most one `devices` row with `revoked_at IS NULL` per employee, and a given hash may be active for only one employee (unique partial indexes). | Maria's phone is bound. Jose cannot bind Maria's phone to his own account while it is active for Maria. | D-06; FR-30 |
| BR-22 | Binding happens on the first mobile login of an active employee. | `bind-device` runs after login. If the employee has no active device, the current phone is bound (`platform`, `model`, `bound_at` recorded). If the same hash is already bound to this employee, the call succeeds without change. Status must be `active`, otherwise `ACCOUNT_NOT_ACTIVE`. | Jose (approved 2026-11-03 09:12) logs in at 2026-11-04 07:40 on his Android phone → bound at 07:40. | D-05, D-06; FR-28, FR-31 |
| BR-23 | A second phone, or a reinstalled app, is blocked until reset. | If the employee already has an active device with a different hash, or the hash is active for another employee, the app shows the Blocked/Bind screen with `DEVICE_MISMATCH` and "ask the administrator to reset your device". Reinstalling the app or clearing its data creates a new installation ID, so it counts as a new phone. | Maria borrows her sister's phone on 2026-11-10 at 07:50 and logs in → `DEVICE_MISMATCH`; no attendance is recorded. | D-06; FR-30 |
| BR-24 | Only the admin resets a device, with a reason. | "Reset device" sets `revoked_at = now()` on the active device, requires a reason (≥ 10 characters), notifies the employee and is audited. The next login from any phone binds that phone. Scans from the old phone after the reset fail with `DEVICE_NOT_BOUND` (no active device yet) or `DEVICE_MISMATCH` (new phone already bound). | Maria's phone is lost. Admin resets at 08:05 with reason "Phone lost, reported 2026-11-10". Maria logs in on a new phone at 08:20 → bound; she scans at 08:22. | D-07; FR-32, FR-33, FR-129, FR-144 |
| BR-25 | Logging out does not unbind. | Logout clears the session from SecureStore but keeps the installation ID and the server binding, so the same phone can log in again without a reset. | Ana logs out at 17:10 and logs back in the next day at 07:45 on the same phone → no reset needed. | FR-140 |

---

## 5. Kiosk QR token

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-26 | Token format is fixed. | Payload `{ v: 1, sid, n, iat, exp }` (station ID, nonce UUID v4, issued-at and expires-at in epoch ms). Token = `base64url(JSON) + "." + base64url(HMAC-SHA256(QR_SIGNING_SECRET, base64url(JSON)))`. QR content = `BHWQR1:` + token. The secret exists only in Edge Function environment variables. | QR text: `BHWQR1:eyJ2IjoxLCJzaWQiOi...fQ.Xk3v...Q`. The app ignores any QR that does not start with `BHWQR1:`. | D-08; FR-37, FR-46 |
| BR-27 | Lifetime 30 s, refresh every 15 s, so tokens overlap. | `exp = iat + token_lifetime_seconds` (30 s). The kiosk asks for a new token every `token_refresh_seconds` (15 s). At any moment up to two tokens are valid, so a scan made just as the QR changes still succeeds. A token is accepted while `now() ≤ exp`. | Token A: issued 08:00:00, expires 08:00:30. Token B: issued 08:00:15, expires 08:00:45. A scan of A at 08:00:29 succeeds; a scan of A at 08:00:31 (or a screenshot of A used at 08:05) fails with `QR_EXPIRED`. | D-09; FR-36, FR-38, FR-48; AC-02 |
| BR-28 | Tokens "from the future" are rejected. | A token with `iat > now() + 5 s` is rejected with `QR_EXPIRED` (it cannot have been issued by this server). | A forged token with `iat` = 08:10:00 scanned at 08:00:00 → `QR_EXPIRED`. | D-09, D-section step 7; FR-48 |
| BR-29 | The nonce must be one the server issued for that station. | `issue-qr-token` inserts each nonce into `qr_nonces` (nonce, station, issued, expiry). On scan, the nonce must exist for the token's `sid`; otherwise `QR_UNKNOWN`. | A correctly signed token whose nonce was already removed by the hourly cleanup → `QR_UNKNOWN`. | D-10; FR-38, FR-49 |
| BR-30 | A nonce is single-use per employee. | Many employees in line may scan the same QR, but one employee can use a nonce only once. A successful scan inserts `(nonce, employee_id)` into `qr_nonce_uses` (composite primary key). A second use by the same employee → `QR_REUSED`. | 08:00:05 Maria scans token B → time-in. 08:00:08 Jose scans token B → time-in. 08:00:20 Maria scans token B again → `QR_REUSED` (this check runs before cooldown). | D-10; FR-49; AC-03 |
| BR-31 | Signing secret rotation has a 60-second overlap. | After a rotation the server verifies against `QR_SIGNING_SECRET` and, for 60 s, also `QR_SIGNING_SECRET_PREVIOUS`. New tokens are always signed with the current secret. | Secret rotated at 22:00:00. A token signed with the old secret at 21:59:50 is accepted at 22:00:10 (still within its own 30 s life). | D-11; FR-42 |
| BR-32 | No expired QR stays on the kiosk screen. | When the kiosk cannot get a new token, it shows the offline banner and hides the QR once the last token's `exp` passes, replacing it with "Reconnecting...". | Internet drops at 09:00:20; last token expires 09:00:45; from 09:00:45 the kiosk shows "Reconnecting...". | FR-41 |
| BR-33 | Nonces are short-lived data. | `qr_nonces` and `qr_nonce_uses` rows older than 1 day are deleted every hour. | A nonce issued 2026-11-09 08:00 is deleted by the hourly job at about 2026-11-10 08:00–09:00. | D-32; FR-147 |

---

## 6. Scan validation

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-34 | Checks run in a fixed order and stop at the first failure. | Order: JWT → rate limit → request body → active employee → device → signature → expiry → nonce known → nonce not reused → station active → GPS accuracy → geofence → cooldown → day not completed → selfie. The returned code is always the first failed check (see Table E-1). | A scan that is both expired and outside the geofence returns only `QR_EXPIRED`, because expiry is checked first. | D-section; FR-47 |
| BR-35 | Rate limit: 10 requests per minute per user. | Counted per authenticated user over a rolling 60-second window for `record-attendance`. The 11th request in that window → `RATE_LIMITED` (429). | Ana taps Scan 11 times between 07:59:00 and 07:59:40 → the 11th returns `RATE_LIMITED`. | D-section step 2; FR-47 |
| BR-36 | GPS must be accurate enough. | `accuracy ≤ max_gps_accuracy_m` (default 50 m), using the accuracy value reported by the phone. Otherwise `GPS_INACCURATE`. | Accuracy 35 m → passes. Accuracy 80 m (indoors, weak signal) → `GPS_INACCURATE`, "move near a window and try again". | D-section step 11; FR-50 |
| BR-37 | The phone must be inside the station geofence. | Haversine distance d = 2R·asin(√(sin²(Δφ/2) + cos φ1·cos φ2·sin²(Δλ/2))), R = 6,371,000 m, between the phone and `stations.latitude/longitude`. Must be `d ≤ stations.radius_m`. A station whose `radius_m` is blank (NULL) uses `app_settings.geofence_radius_m` (100 m), so changing the setting applies to every such station. Otherwise `OUTSIDE_GEOFENCE` with the distance and radius in the message. | Accuracy 20 m, distance 62 m → passes. Accuracy 20 m, distance 140 m → `OUTSIDE_GEOFENCE`: "You are about 140 m from the office...". | D-section step 12; FR-50, FR-108; AC-04 |
| BR-38 | Cooldown after a successful scan. | Rejected with `COOLDOWN_ACTIVE` when `now() < last_successful_scan_at + cooldown_minutes` (default 5). Measured from the employee's last **successful** scan in `scan_attempts` (kiosk or fallback scan); failed attempts never start or extend the cooldown. The message shows when scanning is allowed again. | Maria's time-in succeeds at 07:58:00. She scans again at 08:01:30 → `COOLDOWN_ACTIVE`, "You can scan again at 08:03". A failed scan at 07:57 (`OUTSIDE_GEOFENCE`) did not block her 07:58 scan. | D-20; FR-51 |
| BR-39 | Every attempt is logged. | Each call to `record-attendance` (and `record-fallback-scan`) writes one `scan_attempts` row: employee, station, `success`, `error_code`, `failure_reason`, lat, lng, accuracy, device hash, nonce, server time. Attempts rejected at step 1 (no valid JWT) have no employee and are logged with `employee_id = null`. | Jose's 3 failed scans (`GPS_INACCURATE` ×2, `OUTSIDE_GEOFENCE`) and 1 success at 08:04 make 4 rows. | D-section; FR-55, FR-124 |
| BR-40 | Scans are never queued offline. | If the phone is offline the app refuses to scan (`OFFLINE`) and asks the employee to reconnect and scan again. A queued scan would carry an expired token and an old location, which this system treats as a replay. | No signal at 07:55; Ana moves to the office Wi-Fi and scans at 07:57 → recorded at 07:57, not 07:55. | FR-59 |
| BR-41 | Suspicious activity is flagged, not silently ignored. | A flag is raised for admin review when: one employee has ≥ 5 failed attempts within 10 minutes; repeated `OUTSIDE_GEOFENCE` or `QR_REUSED` failures; or the phone reports a mocked location. A flag does not by itself reject a valid scan. | Jose: 5 failures between 07:50 and 07:58 → flag "Repeated failed scans" on the Device Health page and in the weekly verification report. | FR-58, FR-113, FR-149 |
| BR-42 | Selfie only when switched on. | When `selfie_required = true`, a scan without a selfie → `SELFIE_REQUIRED`. Selfies go to the private `selfies` bucket and are deleted after `selfie_retention_days` (30). | Setting turned on 2026-11-16; Maria's 07:59 scan includes a selfie; the file is deleted on 2026-12-16. | D-31, D-32; FR-57 |

---

## 7. Attendance decision and status

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-43 | Work date and scans after midnight. | Work date = Manila calendar date of the scan. **Exception:** a scan at or after 00:00 and before `overnight_cutoff_hour` (04:00) becomes the previous day's **time-out** when the previous day's record has `time_in` and no `time_out`. In every other case the scan uses today's date. Undertime for such a time-out is 0 because it is later than the scheduled end. | Mon 2026-11-16: Jose time-in 07:58, then works a night vaccination drive. Tue 2026-11-17 01:30 scan → **Mon time-out 01:30** (undertime 0). If Jose's Monday was already closed, a Tue 01:30 scan is a **Tue time-in**. A Tue 04:10 scan is always a Tue scan. | D-13; FR-52 |
| BR-44 | Time-in or time-out is decided by the record for the work date. | See the decision table in section 7.1. Only one time-in/time-out pair per day; no lunch scans. | Jose: 07:55 scan → time-in. 17:03 scan → time-out. 17:20 scan → `ALREADY_COMPLETED`. | D-14; FR-52 |
| BR-45 | Lateness uses the grace period, but counts from start time. | If `time_in ≤ start_time + grace_minutes` then `minutes_late = 0`. Otherwise `minutes_late = time_in − start_time` in whole minutes (BR-03). Arriving early earns no credit. | Start 08:00, grace 15: **08:10 → on time, 0 min late**. 08:15 → on time. **08:16 → late, 16 min** (not 1 min). 07:45 → on time, 0. 13:10 → late, 310 min. | D-15; FR-53 |
| BR-46 | Undertime is early departure only. | `undertime_minutes = max(0, end_time − time_out)` in whole minutes, computed when the time-out is recorded. The formula counts clock minutes; the lunch break is not deducted. | End 17:00: time-out 16:30 → **30 min undertime**. 16:59:40 → 1 min. 17:00 → 0. 17:25 → 0. | D-16; FR-53 |
| BR-47 | One stored status, chosen by precedence. | `absent` > `incomplete` > `late` > `undertime` > `on_time`. `minutes_late` and `undertime_minutes` are always both stored, so a day that is late and undertime is stored as `late` with both numbers. | In 08:40, out 16:45 → `minutes_late = 40`, `undertime_minutes = 15`, status **late**. In 07:55, out 16:30 → status **undertime** (30). In 08:10, out 17:04 → **on_time**. | D-17; FR-53 |
| BR-48 | Status is provisional until time-out. | After time-in only, the record shows `on_time` or `late`. At time-out the status is recomputed with undertime. If no time-out exists when the end-of-day job runs, the status becomes `incomplete` (BR-56). | Maria in at 08:20 → shows **late (20)** all day. Out at 16:50 → stays **late**, `undertime_minutes = 10`. | D-17, D-21; FR-53 |
| BR-49 | Holidays and non-work days accept scans without penalties. | On a date in `holidays`, or a day not in the schedule's `work_days`, a scan is recorded with `minutes_late = 0`, `undertime_minutes = 0`, status `on_time`, `notes` = holiday name or `'Non-working day'`. The end-of-day job never marks absences on these days. | Mon 2026-11-30 (Bonifacio Day, in `holidays`): Jose scans 09:30 and 14:00 → `on_time`, note "Bonifacio Day". Sat 2026-11-14: Ana scans 08:30 and 11:45 → `on_time`, note "Non-working day". Nobody is marked absent on either day. | D-18; FR-54, FR-106, FR-146 |
| BR-50 | An active employee with no schedule can still scan. | The record is stored as `on_time` with `minutes_late = 0`, `undertime_minutes = 0` and `notes = 'No schedule assigned'`. No absences are generated for that employee. The weekly verification report lists them. | Ana's schedule assignment ended 2026-11-15 and no new one was set; her 2026-11-16 07:50 scan is stored with note "No schedule assigned". | D-19; FR-54, FR-149 |
| BR-51 | The schedule in effect on the work date is used. | The schedule is the `employee_schedules` row with `effective_from ≤ work_date` and (`effective_to` is null or `effective_to ≥ work_date`). Assignments for one employee may not overlap (`SCHEDULE_OVERLAP`). Assigning a new schedule closes the previous open assignment on the day before the new `effective_from`. | Maria: Schedule A (08:00–17:00, grace 15) until 2026-11-15; Schedule B (07:00–16:00, grace 15) from 2026-11-16. Fri 2026-11-13 in 07:20 → **on time** under A (07:20 ≤ 08:15). Mon 2026-11-16 in 07:20 → **late, 20 min** under B (07:20 > 07:15 grace limit, counted from 07:00). | D-19; FR-16, FR-104 |
| BR-52 | Schedule changes never rewrite the past automatically. | Editing a schedule or an assignment affects only scans recorded after the change. Past records change only through the admin "recompute" RPC for a chosen employee and date range, which is audited with a reason. Schedules that are or were assigned cannot be deleted (`SCHEDULE_IN_USE`). | On 2026-11-20 the admin changes the grace of Schedule A from 15 to 10. Maria's 2026-11-13 record (in 08:12, on time) stays on time unless the admin runs recompute for that date. | D-19; FR-105, FR-107 |
| BR-53 | A holiday added after the fact needs a recompute. | Holidays should be entered before the date. If a holiday is added for a past date, the admin runs recompute for that date: job-created `absent` rows without a time-in are removed, and scanned records get zero late/undertime with the holiday note. Audited. | 2026-12-08 is declared a holiday on 2026-12-09 at 10:00. The 04:05 job had already marked 3 BHWs absent; recompute removes those 3 rows. | D-18, D-19; FR-105, FR-106 |
| BR-54 | The day is closed after time-in and time-out. | A record with both `time_in` and `time_out` cannot get another scan (`ALREADY_COMPLETED`). Any change after that goes through a correction request or an admin manual entry. | Jose's day is 07:55–17:03. His 17:20 scan → `ALREADY_COMPLETED`, "file a correction request if something is wrong". | D-14, D-section step 14; FR-52 |

### 7.1 Time-in / time-out decision table

| Record for the work date (after BR-43) | Scan becomes | Status after the scan |
| --- | --- | --- |
| None | Time-in (new record) | Provisional `on_time` or `late` (BR-48) |
| Exists with status `absent` and no `time_in` | Time-in (fills that record) | Provisional `on_time` or `late` |
| Has `time_in`, no `time_out` | Time-out | Recomputed: `late`, `undertime` or `on_time` (BR-47) |
| Has `time_in` and `time_out` | Rejected `ALREADY_COMPLETED` | Unchanged |

> **Frontend Designer / Developer note:** because the second successful scan of the day is always a time-out, the Home "Today" card must show plainly whether the next scan will be a time-in or a time-out, and the result overlay must show the undertime minutes when a time-out is earlier than the scheduled end, so an accidental early time-out can be corrected the same day.

---

## 8. End-of-day job and forgotten time-out

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-55 | Absences are marked the next morning. | The job runs daily at `overnight_cutoff_hour` + 5 min = **04:05 Manila (20:05 UTC)** for the **previous** date. For every `active` employee whose schedule in effect has that weekday as a work day, that is not a holiday, and who has no record, it inserts a row with status `absent`, no times, `minutes_late = 0`, `undertime_minutes = 0`, `method = 'qr'`, `station_id` NULL and `created_by` NULL. | Wed 2026-11-11: Jose never scans. Thu 2026-11-12 at 04:05 the job inserts Jose / 2026-11-11 / `absent`. | D-21; FR-146 |
| BR-56 | A forgotten time-out becomes `incomplete`. | The same job sets `status = 'incomplete'` on records of the previous date that have `time_in` and no `time_out`. `minutes_late` is kept; `undertime_minutes` stays 0 until corrected. Because the job runs after the 04:00 overnight cutoff, a scan the next morning is that day's time-in, never the missing time-out. | Mon 2026-11-09: Ana in 08:20, forgets to scan out. Tue 04:05 → Monday becomes `incomplete` (late 20 kept). Tue 07:50 scan → **Tuesday time-in**, Monday stays open. | D-13, D-21; FR-146 |
| BR-57 | The fix for a forgotten time-out is a correction request. | When a record becomes `incomplete`, the employee gets an in-app notification suggesting a `missing_time_out` correction. Once approved, the record gets the time-out, undertime and status are recomputed (BR-68), and the DTR updates. | Ana files "missing time-out 17:05" for 2026-11-09 on Tue 08:10; the admin approves at 10:00 → Monday: in 08:20, out 17:05, `late` (20), undertime 0, method `correction`. | D-21, D-26, D-27; FR-145, FR-68, FR-74 |

---

## 9. Fallback and manual entry

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-58 | Personal QR is only for an active, bound employee. | `issue-personal-qr` issues a token with prefix `BHWPQR1:`, payload `{ v: 1, eid, n, iat, exp }`, signed with `PERSONAL_QR_SIGNING_SECRET`, life 30 s, refreshed every 15 s on the My QR tab. It is issued only when the caller is an `active` employee calling from the bound device. | Maria's camera is broken. At 07:56 she opens My QR; the code changes every 15 s. | D-12; FR-62 |
| BR-59 | A fallback scan follows the kiosk rules, minus location. | On the admin Fallback Scan page the admin picks the station and scans the personal QR. `record-fallback-scan` checks, in order, admin role, request body, signature, expiry, nonce reuse for that employee, employee `active`, station active, cooldown (BR-38) and day not completed, then applies BR-43 to BR-50 exactly like a kiosk scan. GPS and geofence are not checked, because the admin sees the employee in person. The record gets `method = 'fallback_personal_qr'`, the chosen station, `created_by` = admin and an optional note; a `scan_attempts` row is written. | 07:57 the admin scans Maria's personal QR at "BHW Office Main" with note "Phone camera broken" → time-in 07:57, `on_time`, method `fallback_personal_qr`. | D-12, D-14, D-20; FR-63, FR-64 |
| BR-60 | Manual entry is admin-only and needs a reason. | `manual_attendance_entry(employee, work_date, time_in?, time_out?, reason)`: reason at least 10 characters (`REASON_REQUIRED`); work date and times not in the future (`FUTURE_TIME_NOT_ALLOWED`); `time_out` after `time_in` (`INVALID_TIME_RANGE`); time-in on the work date, time-out on the work date or before `overnight_cutoff_hour` (default 04:00) on the next day. The employee must be `active` or `inactive` (not `pending`/`rejected`). It creates the record or replaces the given times; late, undertime and status are recomputed from the schedule in effect on that date (BR-45 to BR-50). Cooldown and geofence do not apply. | Internet outage at the office on 2026-11-12. At 09:30 the admin enters Jose: in 07:52, out blank, reason "Internet outage 07:30–09:15, logbook entry". Stored `on_time`, method `manual`. | D-15 – D-17; FR-65, FR-67 |
| BR-61 | The method shows who or what set the times. | `attendance_method` values: `qr` (kiosk scan), `fallback_personal_qr` (admin scanned personal QR), `manual` (admin manual entry), `correction` (approved correction request). The method reflects the latest source that set a time on the record and is shown as a badge on records, history and DTR source data. | Jose's 2026-11-12: time-in by `manual` at 09:30; time-out by kiosk scan at 17:02 → method becomes `qr`; both changes are in the audit log. | D-28; FR-66 |
| BR-62 | Every fallback scan and manual entry is audited with its reason. | The audit trigger records old and new values; the reason (manual entry) or note (fallback scan) is stored in the audit entry. | Audit row: actor = admin, action `manual_entry`, table `attendance_records`, reason "Internet outage 07:30–09:15, logbook entry", 2026-11-12 09:30:14. | FR-66, FR-126, FR-129; AC-07 |

---

## 10. Correction requests

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-63 | Each request type needs specific times. | `missing_time_in`: requested time-in required (time-out optional, so an absent day can be fixed in one request). `missing_time_out`: requested time-out required; the record must already have a time-in. `wrong_time`: at least one requested time, replacing the recorded one. `official_business`: both times optional (BR-69). Requested time-in must fall on the work date; requested time-out on the work date or before `overnight_cutoff_hour` (default 04:00) on the next day; time-out after time-in (`INVALID_TIME_RANGE`). | Jose files `wrong_time` for 2026-11-10 with requested time-in 07:58 (recorded 08:16, because he scanned late after helping a patient at the door). | D-25; FR-68 |
| BR-64 | Eligibility window: current month, plus 5 days of grace for last month. | The work date must not be in the future, and must be in the current month, **or** in the previous month while today's day-of-month ≤ `correction_window_days` (5). Otherwise `CORRECTION_NOT_ELIGIBLE`. Requested times must not be later than now (`FUTURE_TIME_NOT_ALLOWED`). Eligibility is checked when the request is filed; the admin may review it later. | Today **Wed 2026-11-04** (day 4): a request for Fri 2026-10-30 is **allowed**. Today **Fri 2026-11-06** (day 6): the same request is **rejected**. A request for 2026-11-09 filed on 2026-11-06 is rejected (future). A same-day request at 10:00 for a 08:05 time-in is allowed. | D-26; FR-69 |
| BR-65 | One pending request per employee per work date. | A second `pending` request for the same employee and work date → `CORRECTION_DUPLICATE`. After the first is approved, rejected or cancelled, a new one may be filed. | Ana's request for 2026-11-09 is pending; a second one for 2026-11-09 is refused. A request for 2026-11-10 is allowed. | D-26; FR-69 |
| BR-66 | Reason required; one optional attachment. | Reason at least 10 characters (`REASON_REQUIRED`). Attachment: one image (JPEG, PNG, WebP) or PDF, at most 5 MB, stored in the private `correction-attachments` bucket, viewed by signed URL. | Ana attaches `travel-order.pdf` (1.2 MB) to an official business request. A 7 MB PDF → `FILE_TOO_LARGE`. | D-26, D-31; FR-68, FR-70 |
| BR-67 | Only pending requests can be cancelled, and only by their owner. | The employee may set their own `pending` request to `cancelled`. Approved, rejected and cancelled requests cannot be changed by anyone (`REQUEST_NOT_PENDING`). | Jose cancels his 2026-11-10 request at 11:00 before review → `cancelled`. | D-27; FR-72 |
| BR-68 | Approval updates the record in one transaction. | `review_correction_request(approve)` in a single transaction: (1) create or update the attendance record for the work date with the requested times (an `absent` record is filled); (2) set `method = 'correction'`; (3) recompute `minutes_late`, `undertime_minutes` and status from the schedule in effect on that date, with holiday/non-work-day rules (BR-45 to BR-50); a record still without time-out stays `incomplete` (or provisional if it is today); (4) set the request `approved`, `reviewed_by`, `reviewed_at`, remarks; (5) create the employee notification; (6) audit. If any step fails, nothing changes. The DTR shows the new values at once because it is built live (BR-80). | Jose's `wrong_time` (time-in 08:16 → 07:58) for Tue 2026-11-10 is approved on 2026-11-11 at 09:00: `minutes_late` 16 → 0, status `late` → `on_time`, method `correction`; DTR undertime for Nov 10 goes from 0:16 to blank. | D-27, D-28; FR-74, FR-77, FR-85; AC-08 |
| BR-69 | Official business with blank times uses the schedule. | When an approved `official_business` request has both times blank, time-in = schedule `start_time` and time-out = schedule `end_time` on the work date, `notes = 'Official business'`. If no schedule is in effect, both times must be entered. | Ana attends a municipal health seminar on Thu 2026-11-12 (both times blank) → in 08:00, out 17:00, `on_time`, note "Official business". | D-28; FR-75 |
| BR-70 | Rejection keeps the record unchanged and needs remarks. | Rejection requires remarks (at least 10 characters), sets `rejected`, `reviewed_by`, `reviewed_at`, notifies the employee (in-app and email when configured) and is audited. The attendance record is not touched. | "Logbook shows time-in at 08:20, not 07:58." Jose's record stays `late`, 16 minutes. | D-27; FR-74, FR-76 |
| BR-71 | Correction request status changes follow the state table in 10.1. | Any other change is refused (`REQUEST_NOT_PENDING`). | Approving an already rejected request is refused. | D-26, D-27 |

### 10.1 Correction request state table

| From | Event | To | Who | Effects |
| --- | --- | --- | --- | --- |
| (none) | File request | `pending` | Employee | Eligibility checked (BR-63 – BR-66); admins notified; audited |
| `pending` | Cancel | `cancelled` | Employee (owner) | Audited; no record change |
| `pending` | Approve (remarks optional) | `approved` | Admin | Record updated in one transaction (BR-68); employee notified; audited |
| `pending` | Reject (remarks required) | `rejected` | Admin | No record change; employee notified; audited |

`approved`, `rejected` and `cancelled` are final.

---

## 11. DTR (Civil Service Form No. 48)

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-72 | One row for each calendar day. | `get_dtr(employee_id, year, month)` always returns 31 rows (the 31 printed lines of CSC Form No. 48); rows after the month's last day have `work_date` NULL and are blank on the printed form. | November 2026 has 30 rows; row 31 is blank on the form. | D-22; FR-78 |
| BR-73 | AM/PM placement depends on the break times. | If `time_in < break_start` → **AM Arrival**; else → **PM Arrival**. If `time_out > break_end` → **PM Departure**; else → **AM Departure**. | Break 12:00–13:00. In 08:10 → AM Arrival. In 13:10 → PM Arrival. Out 17:04 → PM Departure. Out 11:45 → AM Departure. | D-22; FR-79 |
| BR-74 | Lunch cells stay blank unless the setting fills them. | Only one pair is scanned per day, so AM Departure and PM Arrival are normally blank. When `dtr_fill_break_times = true` and the day spans the break (time-in before `break_start` and time-out after `break_end`), AM Departure shows `break_start` and PM Arrival shows `break_end`. | Setting on: Mon 08:10–17:04 prints 08:10 / 12:00 / 13:00 / 17:04. Sat 08:30–11:45 prints 08:30 / 11:45 / blank / blank. | D-22; FR-79 |
| BR-75 | Days without a scan show a label. | Weekends and non-work days with no record show the day name ("Saturday", "Sunday"); holidays with no record show the holiday name. Days with a record print the times as usual. | Sun 2026-11-15 → "Sunday". Mon 2026-11-30 with no scan → "Bonifacio Day". | D-22; FR-79 |
| BR-76 | DTR undertime = tardiness + early departure. | Daily DTR undertime (hours, minutes) = `minutes_late + undertime_minutes`. Hours = minutes ÷ 60 (whole), minutes = remainder. Zero prints blank. | In 08:40, out 16:45 → 40 + 15 = 55 → **0 h 55 min**. | D-23; FR-80 |
| BR-77 | Absent and incomplete days. | Absent work day: the word **"Absent"** across the time cells and undertime = full scheduled minutes = `end − start − (break_end − break_start)`. Incomplete day: arrival printed, "No time-out" in the departure cells, undertime = `minutes_late + undertime_minutes` as recorded (undertime part is 0 until corrected). | Absent under 08:00–17:00 with 12:00–13:00 break → 540 − 60 = 480 → **8 h 0 min**. Incomplete with time-in 08:20 → "No time-out", **0 h 20 min**. | D-23; FR-80 |
| BR-78 | Monthly totals are sums of the daily values. | Total undertime minutes = Σ daily DTR undertime minutes; printed as hours and minutes. No rounding other than BR-03. | See the worked week below: 581 min → 9 h 41 min. | D-23; FR-80; AC-09 |
| BR-79 | Header and footer follow CSC Form 48. | Header: "Civil Service Form No. 48", "DAILY TIME RECORD", employee name, "For the month of November 2026", "Official hours for arrival and departure: Regular days 08:00–17:00; Saturdays —" (from the schedule). Footer: the certification text "I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.", employee signature line, "Verified as to the prescribed office hours:", in-charge signature line. | Schedule Mon–Fri → "Saturdays" line prints "—". | D-24; FR-81 |
| BR-80 | The DTR is always built live. | No DTR copy is stored. Each request reads the current `attendance_records`, so approved corrections, manual entries and fallback scans appear immediately. Batch generation (`get_dtr_batch`) applies the same rules to every active employee, one per page. | Correction approved at 09:00; the PDF downloaded at 09:01 already shows the new time. | FR-83, FR-85; AC-08 |

### 11.1 Worked example: one week of Maria Santos' DTR

Schedule Mon–Fri 08:00–17:00, grace 15, break 12:00–13:00, `dtr_fill_break_times = false`. Week Monday 2026-11-09 to Sunday 2026-11-15.

| Day | Scans (Manila) | `minutes_late` | `undertime_minutes` | Stored status | AM Arrival | AM Departure | PM Arrival | PM Departure | DTR undertime (h : min) | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mon 9 | in 08:10, out 17:04 | 0 | 0 | `on_time` | 08:10 | | | 17:04 | (blank) | 08:10 ≤ 08:15 grace limit |
| Tue 10 | in 08:16, out 17:00 | 16 | 0 | `late` | 08:16 | | | 17:00 | 0 : 16 | 08:16 > 08:15, counted from 08:00 |
| Wed 11 | none (job at Thu 04:05) | 0 | 0 | `absent` | Absent | Absent | Absent | Absent | 8 : 00 | 540 − 60 break = 480 min |
| Thu 12 | in 07:55, out 16:30 | 0 | 30 | `undertime` | 07:55 | | | 16:30 | 0 : 30 | Left 30 min early |
| Fri 13 | in 08:40, out 16:45 | 40 | 15 | `late` | 08:40 | | | 16:45 | 0 : 55 | Late beats undertime; both kept |
| Sat 14 | in 08:30, out 11:45 | 0 | 0 | `on_time`, note "Non-working day" | 08:30 | 11:45 | | | (blank) | Field work on a non-work day |
| Sun 15 | none | — | — | (no record) | Sunday | | | | (blank) | Non-work day label |
| **Week total** | | **56** | **45** | | | | | | **9 : 41** | 16 + 480 + 30 + 55 = 581 min |

The same week in the weekly report (BR-81 – BR-85): on time 2 (Mon, Sat), late 2 (Tue, Fri), undertime 1 (Thu), absent 1 (Wed), incomplete 0, **present 5**, total late minutes 56, total undertime minutes 45. The DTR total (581) is larger because the DTR undertime column also includes lateness and full absent days (BR-76, BR-77).

---

## 12. Reports and dashboard counts

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-81 | Reports read only `attendance_records`. | Daily, weekly and monthly totals are computed only from stored `attendance_records` rows with the stored `status`, `minutes_late` and `undertime_minutes`. Reports never recompute status and never read `scan_attempts`. This is why reports match the raw records exactly. | Counting the Attendance Records page filtered to 2026-11-10 gives the same numbers as the daily report for 2026-11-10. | FR-86 – FR-88, FR-92; AC-06 |
| BR-82 | Present = any record with a time-in. | `present = count(on_time) + count(late) + count(undertime) + count(incomplete)`. The employee reported for work on every one of these days. Non-work-day and holiday scans are stored `on_time` and therefore count as present on that date. The same definition is used by the DTR totals, the monthly report and the dashboard (`days_present`, `present_count`). | Tue 2026-11-10 for 8 BHWs: on time 5, late 1, undertime 0, incomplete 1 → present 7. | FR-86, FR-88, FR-95; AC-06 |
| BR-83 | Absent is separate; incomplete is present but also counted on its own. | `absent` is never added to present. `incomplete` is counted as present and is also shown in its own column until it is corrected. | Same day: present 7 (of which incomplete 1), absent 1 → 7 + 1 = 8 employees. | FR-86 – FR-88 |
| BR-84 | Report periods. | Daily: one Manila date. Weekly: **Monday 00:00 to Sunday 23:59** Manila, containing the selected date. Monthly: the 1st to the last day of the calendar month. A record belongs to a period by its `work_date`. | Selected date Wed 2026-11-11 → week 2026-11-09 (Mon) to 2026-11-15 (Sun). A record with work date Sun 2026-11-15 whose time-out was scanned Mon 2026-11-16 at 01:30 (BR-43) belongs to the week of 2026-11-09. | FR-87, FR-88 |
| BR-85 | Minute totals. | Total late minutes = Σ `minutes_late`; total undertime minutes = Σ `undertime_minutes`; both shown also as hours and minutes. These differ from the DTR undertime column, which adds lateness and full absent days (BR-76, BR-77). | Maria's week (11.1): late 56, undertime 45; DTR 581. | FR-87, FR-88 |
| BR-86 | Today's numbers are provisional. | Before the next 04:05 job, `absent` rows for today do not exist yet. The dashboard and the daily report for today show a separate "No record yet" count = active employees scheduled today (not a holiday) without a record. Records with time-in but no time-out show their provisional status and count as present; they stay present after the job sets `incomplete` (BR-82). | Tue 2026-11-10 at 10:00: 6 scanned in, 2 "No record yet". At 04:05 on Wed the 2 become `absent` (if they never scanned). | D-17, D-21; FR-95, FR-97 |
| BR-87 | Export format. | CSV in UTF-8 with Manila times as `YYYY-MM-DD HH:mm`; PDF/print with the barangay header (`office_name`, `office_address`), period, "Generated by {name} on {Manila timestamp}". Report exports never contain contact numbers or addresses. | `2026-11-10 08:16` in the CSV time-in column; PDF footer "Generated by Admin Kalawag on 2026-11-16 15:42". | FR-90, FR-91, FR-134 |
| BR-88 | Viewers are read-only. | Viewers see aggregated reports and names, can print/export them, and see the read-only dashboard. They cannot see contact data, photos, locations, audit or error logs, and cannot create, edit, approve or reset anything. | The barangay captain (viewer) exports the November monthly report; the "Approve" buttons are not shown. | FR-93, FR-101 |

---

## 13. Kiosk health and device sync

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-89 | Heartbeat every 60 s. | The kiosk calls `kiosk-heartbeat` every `heartbeat_interval_seconds` (60) with app version, clock drift and last token time. The server stores a `kiosk_heartbeats` row and sets `stations.last_seen_at = now()`, `is_online = true`. After a reconnect the kiosk sends a heartbeat and requests a token at once. | Heartbeats at 09:00:10, 09:01:10, 09:02:10 ... | D-34; FR-109, FR-118 |
| BR-90 | Offline after 3 missed heartbeats. | A pg_cron check every minute sets `is_online = false` when `last_seen_at < now() − 3 × heartbeat_interval` (180 s). On the change from online to offline it inserts an `error_logs` row (source `kiosk`, severity `critical`) and Realtime pushes the change to the dashboard. The station is back online on its next heartbeat. Measured from the first missed heartbeat, the alert appears within 3 minutes. | Last heartbeat 09:00:10; the next one (due 09:01:10) never arrives. The 09:04:00 check finds 09:00:10 < 09:01:00 → offline; the dashboard shows the alert at about 09:04:01 (2 min 51 s after the missed beat). | D-34; FR-110, FR-148; AC-10 |
| BR-91 | Clock drift warning above 30 s. | `clock_drift_ms = kiosk Date.now() − server time` on each heartbeat. A drift above 30,000 ms (either direction) shows a warning on Device Health and the dashboard. Drift never affects attendance (BR-02). | Tablet shows 09:15:42 when the server time is 09:15:00 → drift +42,000 ms → warning "Kiosk clock is 42 s fast". | D-34; FR-100, FR-111, FR-119 |
| BR-92 | When the kiosk is down, use the fallback. | While a station is offline no valid kiosk QR exists (BR-32), so employees use the personal QR scanned by the admin (BR-59) or the admin uses manual entry with a reason (BR-60). A future fingerprint terminal posts to `device-sync` with a unique event ID; a repeated event ID returns the original result and creates nothing new. | Kiosk offline 07:40–08:30 on 2026-11-12: the admin fallback-scans 6 BHWs at the front desk. | FR-63, FR-65, FR-116, FR-117 |

---

## 14. Security, privacy, audit and retention

| ID | Rule | Details / formula | Example (Manila time) | Source |
| --- | --- | --- | --- | --- |
| BR-93 | Sensitive profile fields are encrypted at rest. | `contact_number` and `address` are stored only as `contact_number_enc` / `address_enc` (`bytea`) using `pgp_sym_encrypt` with the key from Supabase Vault secret `profile_encryption_key`, inside `SECURITY DEFINER` functions. Plain values are returned only by `get_profile_private(uuid)` to the owner and admins. | A database dump shows `\xc30d0407...` in `contact_number_enc`; Maria sees `09171234567` on her profile. | D-29; FR-07, FR-12; AC-12 |
| BR-94 | No biometric data is stored. | Phone fingerprint / Face ID only unlocks the scan screen on the phone (`expo-local-authentication`). No fingerprint, face template or biometric result is sent to the server. | Biometric unlock fails → `BIOMETRIC_FAILED` on the phone only; nothing is logged on the server except an optional error report without biometric content. | D-30; FR-44; AC-12 |
| BR-95 | Files are private and shared only by short links. | Buckets `profile-photos`, `selfies` and `correction-attachments` are private; files are viewed only through signed URLs that expire in at most 60 minutes. | The admin opens Ana's travel order at 10:00; the link stops working at 11:00. | D-31; FR-06, FR-70 |
| BR-96 | Audit logs are complete and append-only. | Triggers on `attendance_records`, `profiles`, `devices`, `correction_requests`, `schedules` (plus `employee_schedules`, `stations`, `holidays`, `app_settings`) write actor, action, table, record ID, old data, new data, server time, except updates that change only `stations.last_seen_at` and `stations.is_online` (heartbeat and offline-detection writes), which are excluded to avoid about 1,440 rows per station per day; offline transitions are recorded in `error_logs` instead (D-34). No role can update or delete audit rows through the API. Encrypted fields appear only as a "[changed]" marker. Reasons (manual entry, fallback note, device reset, correction review, status change) are included. | Admin edits Jose's contact number → audit row shows `contact_number_enc: "[changed]"`, not the number. | FR-126 – FR-131; AC-07 |
| BR-97 | Data is deleted when its retention period ends. | See the retention table in 14.1. Nonces are cleaned hourly; all other retention deletions run daily. Deletions run as scheduled jobs and their outcome is recorded. | A `scan_attempts` row from 2026-11-10 07:58 is deleted on about 2027-11-10. | D-32; FR-147, FR-150, FR-151 |
| BR-98 | Error reports carry no secrets or personal data. | Before storing in `error_logs`, the context is stripped of tokens, secrets, passwords, raw device IDs and decrypted personal fields. `log-error` is rate limited per user. | A mobile crash report containing `token: "BHWQR1:..."` is stored as `token: "[removed]"`. | FR-120 – FR-122 |

### 14.1 Retention schedule

| Data | Kept for | Deleted by |
| --- | --- | --- |
| `qr_nonces`, `qr_nonce_uses` | 1 day | Hourly job |
| Selfies (`selfies` bucket) | 30 days (`selfie_retention_days`) | Daily job |
| `kiosk_heartbeats` | 30 days | Daily job |
| `error_logs` | 180 days | Daily job |
| `scan_attempts` (includes locations) | 1 year | Daily job |
| Rejected registrations (profile, auth user, photo) | 90 days after rejection | Daily job |
| `notifications` | 1 year | Daily job |
| `attendance_records`, `correction_requests` (and attachments), `audit_logs` | 5 years | Daily job |

---

## 15. Error-code catalog

This catalog is the single list of error codes and user messages. Edge Functions return the `code` and HTTP status; the web portal and mobile app show the message for that code in the user's chosen language (English or Filipino) and fill the values in braces. Edge Functions also include the English message in their response for logging. Messages are polite, plain and tell the user what to do next.

### Table E-1: `record-attendance` codes (section D of the decisions file, in validation order)

| Code | HTTP | When | English message | Filipino message |
| --- | --- | --- | --- | --- |
| `AUTH_REQUIRED` | 401 | Step 1: missing, invalid or expired login token (JWT). | Your session has ended. Please log in again. | Natapos na ang iyong session. Paki-login po muli. |
| `RATE_LIMITED` | 429 | Step 2: more than 10 requests in one minute by the same user. | Too many attempts. Please wait one minute, then try again. | Masyadong maraming pagsubok. Maghintay po ng isang minuto bago subukang muli. |
| `INVALID_REQUEST` | 400 | Step 3: the request body fails the shared zod schema (missing or wrong fields). | Something is wrong with the data sent. Please update the app and try again. | May mali sa ipinadalang datos. Paki-update po ang app at subukang muli. |
| `ACCOUNT_NOT_ACTIVE` | 403 | Step 4: the user is not an employee, or the status is `pending`, `rejected` or `inactive`. | Your account is not active. Please wait for approval or contact the BHW office administrator. | Hindi pa aktibo ang iyong account. Hintayin po ang pag-apruba o makipag-ugnayan sa administrator ng BHW office. |
| `DEVICE_NOT_BOUND` | 403 | Step 5: the employee has no active bound device (new account or after a reset). | This phone is not yet registered to your account. Please log in again to register it. | Hindi pa nakarehistro ang teleponong ito sa iyong account. Mag-login po muli para mairehistro ito. |
| `DEVICE_MISMATCH` | 403 | Step 5: the phone's hash differs from the employee's active device, or the phone is bound to another employee. | Your account is registered to a different phone. Please ask the administrator to reset your device. | Nakarehistro ang iyong account sa ibang telepono. Pakiusap, hilingin sa administrator na i-reset ang iyong device. |
| `QR_INVALID` | 400 | Step 6: wrong prefix, bad format or the HMAC signature does not match (also used for personal QR on fallback scan). | This QR code is not valid. Please scan a QR code from the BHW attendance system. | Hindi wasto ang QR code na ito. Paki-scan po ang QR code mula sa BHW attendance system. |
| `QR_EXPIRED` | 400 | Step 7: `now() > exp`, or `iat` more than 5 s in the future (screenshots and old photos of the QR). | This QR code has expired. Please scan the newest QR code on the screen. | Lipas na ang QR code na ito. Paki-scan po ang pinakabagong QR code sa screen. |
| `QR_UNKNOWN` | 400 | Step 8: the nonce is not in `qr_nonces` for that station. | This QR code was not issued by the office kiosk. Please scan the QR code on the kiosk screen. | Hindi galing sa kiosk ng opisina ang QR code na ito. Paki-scan po ang QR code na nasa screen ng kiosk. |
| `QR_REUSED` | 409 | Step 9: this employee already used this nonce. | You have already used this QR code. Please wait for the next QR code and scan again. | Nagamit mo na ang QR code na ito. Hintayin po ang susunod na QR code at mag-scan muli. |
| `STATION_INACTIVE` | 400 | Step 10: the station does not exist or is not active. | This attendance station is not active. Please contact the administrator. | Hindi aktibo ang attendance station na ito. Makipag-ugnayan po sa administrator. |
| `GPS_INACCURATE` | 400 | Step 11: GPS accuracy is worse than `max_gps_accuracy_m` (50 m). | Your location is not accurate enough ({accuracy} m; {max} m or better is needed). Please move near a window or outside, wait a few seconds, and try again. | Hindi pa sapat ang linaw ng iyong lokasyon ({accuracy} m; kailangan ay {max} m o mas mababa). Lumapit po sa bintana o lumabas sandali, maghintay ng ilang segundo, at subukang muli. |
| `OUTSIDE_GEOFENCE` | 403 | Step 12: Haversine distance is greater than the station radius (100 m). | You are about {distance} m from the office. Please move closer to the BHW office (within {radius} m) and scan again. | Mga {distance} metro ang layo mo sa opisina. Lumapit po sa BHW office (hanggang {radius} metro) at mag-scan muli. |
| `COOLDOWN_ACTIVE` | 429 | Step 13: a successful scan by this employee happened less than `cooldown_minutes` (5) ago. | Your last scan was recorded at {last_time}. You can scan again at {next_time}. | Naitala na ang huli mong scan noong {last_time}. Maaari kang mag-scan muli pagsapit ng {next_time}. |
| `ALREADY_COMPLETED` | 409 | Step 14: the work date already has time-in and time-out. | Your time-in and time-out for today are already recorded. If something is wrong, please file a correction request. | Naitala na ang iyong time-in at time-out ngayong araw. Kung may mali, mag-file po ng correction request. |
| `SELFIE_REQUIRED` | 400 | Step 15: `selfie_required = true` and no selfie was sent. | A selfie is required for this scan. Please allow the front camera and try again. | Kailangan po ng selfie para sa scan na ito. Payagan ang front camera at subukang muli. |
| `INTERNAL_ERROR` | 500 | Any unexpected server error (also logged to `error_logs`). | Something went wrong on our side. Please try again. If it keeps happening, please tell the administrator. | Nagkaproblema po ang system. Pakisubukang muli. Kung paulit-ulit ito, ipaalam po sa administrator. |

### Table E-2: mobile-only pre-scan codes (never sent to the server)

| Code | HTTP | When | English message | Filipino message |
| --- | --- | --- | --- | --- |
| `CAMERA_DENIED` | — | Camera permission is off. | Camera access is turned off. Please allow the camera in your phone settings so you can scan. | Naka-off ang pahintulot sa camera. Payagan po ang camera sa settings ng telepono para makapag-scan. |
| `LOCATION_DENIED` | — | Location permission is off. | Location access is turned off. Please allow location in your phone settings so you can scan. | Naka-off ang pahintulot sa lokasyon. Payagan po ang location sa settings ng telepono para makapag-scan. |
| `LOCATION_UNAVAILABLE` | — | Location services are off or no position could be found. | We cannot get your location. Please turn on GPS/Location and try again. | Hindi makuha ang iyong lokasyon. Pakibuksan po ang GPS/Location at subukang muli. |
| `OFFLINE` | — | No internet connection. Scans are never queued (BR-40). | You are offline. Please connect to the internet and scan again. Scans are not saved while offline. | Wala kang internet connection. Kumonekta po sa internet at mag-scan muli. Hindi naiitala ang scan habang offline. |
| `BIOMETRIC_FAILED` | — | Phone fingerprint / Face ID unlock failed or was cancelled. | Fingerprint or Face ID check did not succeed. Please try again or use your phone's passcode. | Hindi nagtagumpay ang fingerprint o Face ID. Subukan po muli o gamitin ang passcode ng iyong telepono. |

### Table E-3: codes used by other Edge Functions and RPCs (added in this document)

These codes are not in section D of the decisions file; they are added here so that `bind-device`, `issue-personal-qr`, `record-fallback-scan`, `manual_attendance_entry`, the correction, registration and schedule functions answer in the same style. Personal QR failures reuse `QR_INVALID`, `QR_EXPIRED` and `QR_REUSED` from Table E-1.

| Code | HTTP | When | English message | Filipino message |
| --- | --- | --- | --- | --- |
| `FORBIDDEN` | 403 | The caller's role may not perform this action in an RPC or Edge Function other than `record-attendance` (e.g. a kiosk requesting a token for another station, a non-admin calling an admin RPC). | You do not have permission to do this. | Wala po kayong pahintulot na gawin ito. |
| `NOT_FOUND` | 404 | The employee, record, request or station does not exist or is not visible to the caller. | We could not find what you are looking for. It may have been removed. | Hindi po namin makita ang hinahanap ninyo. Maaaring natanggal na ito. |
| `EMAIL_TAKEN` | 409 | Registration with an email already in use (BR-07). | This email is already registered. Please log in or use a different email. | Nakarehistro na ang email na ito. Mag-login po o gumamit ng ibang email. |
| `BHW_ID_TAKEN` | 409 | Registration or edit with a BHW ID number already in use (BR-06). | This BHW ID number is already registered. Please check the number or contact the administrator. | Nakarehistro na ang BHW ID number na ito. Pakisuri po ang numero o makipag-ugnayan sa administrator. |
| `CONSENT_REQUIRED` | 400 | Registration without the Data Privacy consent (BR-08). | Please read and agree to the Data Privacy notice to continue. | Pakibasa po at sumang-ayon sa Data Privacy notice upang makapagpatuloy. |
| `FILE_TOO_LARGE` | 413 | Profile photo or attachment over 5 MB (BR-09, BR-66). | The file is too large. Photos and attachments must be 5 MB or smaller. | Masyadong malaki ang file. Ang larawan at attachment ay dapat 5 MB pababa. |
| `FILE_TYPE_NOT_ALLOWED` | 415 | Photo not JPEG/PNG/WebP, or attachment not an image or PDF. | This file type is not allowed. Please use a JPG, PNG or WebP image (or PDF for attachments). | Hindi tinatanggap ang ganitong uri ng file. Gumamit po ng JPG, PNG o WebP na larawan (o PDF para sa attachment). |
| `REASON_REQUIRED` | 400 | Manual entry, device reset, deactivation, registration rejection, correction request or correction rejection without a reason/remarks of at least 10 characters. | Please enter a reason of at least 10 characters. | Maglagay po ng dahilan na hindi bababa sa 10 character. |
| `FUTURE_TIME_NOT_ALLOWED` | 400 | Manual entry or correction with a date or time later than now. | The date or time cannot be in the future. Please check and try again. | Hindi maaaring nasa hinaharap ang petsa o oras. Pakisuri po at subukang muli. |
| `INVALID_TIME_RANGE` | 400 | Time-out not after time-in, or a time outside the allowed work-date window (BR-60, BR-63). | Time-out must be later than time-in on the same work date. Please check the times. | Dapat mas huli ang time-out kaysa sa time-in sa parehong araw ng trabaho. Pakisuri po ang mga oras. |
| `CORRECTION_NOT_ELIGIBLE` | 422 | Work date outside the correction window or in the future (BR-64), or the record does not fit the request type (BR-63). | This date can no longer be corrected through the app. Please talk to the administrator. | Hindi na maaaring itama ang petsang ito sa app. Makipag-usap po sa administrator. |
| `CORRECTION_DUPLICATE` | 409 | A pending request already exists for this work date (BR-65). | You already have a pending request for this date. Please wait for the admin's decision or cancel it first. | May nakabinbin ka nang request para sa petsang ito. Hintayin po ang desisyon ng admin o i-cancel muna ito. |
| `REQUEST_NOT_PENDING` | 409 | Trying to cancel, approve or reject a request that is no longer `pending` (BR-67, BR-71). | This request has already been processed and can no longer be changed. | Naproseso na po ang request na ito at hindi na maaaring baguhin. |
| `SCHEDULE_REQUIRED` | 400 | Approving a registration without a schedule (BR-12), or an official business request with blank times and no schedule (BR-69). | Please choose a schedule first. | Pumili po muna ng schedule. |
| `PHOTO_REQUIRED` | 400 | Approving a registration whose profile has no photo (BR-12a), or a registration submitted without one. | A profile photo is required. Please add a clear photo of your face. | Kailangan po ng profile photo. Magdagdag ng malinaw na larawan ng iyong mukha. |
| `SCHEDULE_OVERLAP` | 409 | A new schedule assignment overlaps an existing one for the same employee (BR-51). | This schedule overlaps another schedule for this employee. Please change the dates. | Nagsasapawan ang schedule na ito sa ibang schedule ng empleyado. Pakibago po ang mga petsa. |
| `SCHEDULE_IN_USE` | 409 | Deleting a schedule that is or was assigned (BR-52). | This schedule is or was assigned to employees and cannot be deleted. You can create a new schedule instead. | Naitalaga na ang schedule na ito sa mga empleyado kaya hindi ito mabubura. Maaari po kayong gumawa ng bagong schedule. |

Total: 17 codes in Table E-1, 5 in Table E-2 and 16 in Table E-3, for 38 distinct codes.

---

> **System Analyst note on alignment:** Values set here that are not in D-01 – D-34: minute truncation (BR-03), reason/remarks of at least 10 characters for all admin and employee reasons, the "No record yet" count for today (BR-86), cooldown also applying to fallback scans (BR-59), and the Table E-3 codes.
>
> **Backend Developer note:** `compute_attendance_status()` must truncate seconds (BR-03) and take the schedule in effect on the work date (BR-51). `record-fallback-scan` writes a `scan_attempts` row with null `lat`, `lng`, `accuracy` and `device_id_hash`, so those columns must be nullable and the cooldown query (BR-38) covers fallback scans. All codes in Tables E-1 to E-3 go into `supabase/functions/_shared/error-codes.ts` with their HTTP status.
>
> **Frontend Designer / Developer note:** Tables E-1 to E-3 are the source for the `en` and `fil` message maps in the web portal and the mobile app (`packages/types`), including the `{accuracy}`, `{max}`, `{distance}`, `{radius}`, `{last_time}` and `{next_time}` values that the Edge Function response must provide. Times in messages are shown as Manila `HH:mm`.
