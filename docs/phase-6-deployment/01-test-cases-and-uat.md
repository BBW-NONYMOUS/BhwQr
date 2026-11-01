# Phase 6 – Test Cases and User Acceptance Testing (UAT)

> **Role speaking: System Analyst**

This document gives the Phase 6 test case table, the coverage of the 12 acceptance criteria, and a printable UAT form for barangay users. Every test case is traced to the functional requirements in [`02-functional-requirements.md`](../phase-1-system-analysis/02-functional-requirements.md) (FR-xx), the business rules in [`05-business-rules.md`](../phase-1-system-analysis/05-business-rules.md) (BR-xx) and the acceptance criteria (AC-01 – AC-12). Error codes, HTTP statuses and messages are taken from the error-code catalog (Tables E-1 to E-3 in `05-business-rules.md`) and the fixed validation order in section D of [`00-assumptions-and-decisions.md`](../phase-1-system-analysis/00-assumptions-and-decisions.md).

## 0. Test environment and result legend

| Item | Value |
| --- | --- |
| Backend | Hosted Supabase dev project `zzspfykdcjsvpjriomwf` with migrations `20261101000000` – `20261101000900` and `supabase/seed.sql` applied |
| Seed data | `admin@bhw.local`, `kiosk@bhw.local` (station "BHW Office – Main Entrance", 6.631100, 124.604700, radius 100 m), `viewer@bhw.local`, 8 active BHWs (e.g. `maria.santos@bhw.local` BHW-KII-2019-001, `lorna.bautista@bhw.local` BHW-KII-2023-008) |
| Seed schedule | "Regular Mon–Fri 08:00–17:00", break 12:00–13:00, grace 15 minutes |
| Default settings | Token lifetime 30 s, refresh 15 s, GPS accuracy ≤ 50 m, geofence 100 m, cooldown 5 min, rate limit 10/min, heartbeat 60 s, overnight cutoff 04:00, correction window 5 days |
| Time zone | All times below are Asia/Manila (BR-01). Example dates: Monday 2026-11-09; holiday Monday 2026-11-30 (Bonifacio Day) |

Automated suites and their recorded runs (Phase 3 README §8–9, Phase 4 README §6, Phase 5 README §4):

| Suite | Command | Recorded result (2026-11-01) |
| --- | --- | --- |
| Edge Function unit tests `supabase/functions/record-attendance/handler.test.ts` | `pnpm functions:test` | 21/21 pass |
| RLS + RPC smoke through the public API `scripts/smoke-remote.mjs` | `pnpm smoke:remote` | 23/23 pass (counts compared with the live number of active BHWs) |
| End-to-end scan flow through deployed functions `scripts/smoke-functions.mjs` | `pnpm smoke:functions` | 14/14 pass (uses the fixed test installation ID shared with `perf-check.mjs`, so every scan rule runs on each run) |
| Web unit tests (Vitest, 22 files in `apps/web/components` and `apps/web/lib`) | `pnpm --filter @bhw/web test` | 223/223 pass |
| Web Playwright `apps/web/e2e/*.spec.ts` | `pnpm --filter @bhw/web test:e2e` | 24 pass, 1 skipped (`dashboard-latency`, runs with `PERF=1`): smoke, kiosk, reports, page sweep, responsive (all pages at 360/768/1280 px), register → approve → login |
| Mobile Jest + RNTL `apps/mobile/__tests__` | `pnpm --filter @bhw/mobile test` | 87/87 pass |
| pgTAP `supabase/tests/database/*.test.sql` | `pnpm db:test:remote` or `pnpm db:test` | **Not executed yet** |
| Shared schema tests `packages/types/src/schemas.test.ts` | `pnpm --filter @bhw/types test` | No run recorded in the phase READMEs; listed as supporting evidence only |

Result values used in the table:

- **Pass (automated, 2026-11-01)** – at least one referenced automated test that exercises the expected result ran and passed on 2026-11-01 according to the phase READMEs.
- **Pending (pgTAP not yet executed)** – the behaviour is covered by pgTAP assertions only (client-side tests, if listed, check display or input validation, not the server rule). Run `pnpm db:test:remote` and update the result.
- **Pending (manual UAT)** – needs a real phone, the kiosk tablet, a stopwatch, a person reading the screen, or a test that has not been run. To be executed during UAT with the steps given.

## 1. Test case table

Abbreviations: pgTAP files are under `supabase/tests/database/`; web Vitest files under `apps/web/`; mobile Jest files under `apps/mobile/__tests__/`. Test names are quoted exactly as written in the files.

### 1.1 Registration and account status

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-01 | Registration with Data Privacy consent | Web portal open at `/register`; e-mail not yet used | 1. Fill in all fields, leave the consent box unticked, submit. 2. Tick the consent box, submit. 3. Open the verification e-mail link. | Step 1: form is not sent; message "Please read and agree to the Data Privacy notice to continue." (`CONSENT_REQUIRED`, 400 if sent to the server). Step 2: success screen; `profiles` row with role `employee`, status `pending`, `consent_at` set; contact number and address stored encrypted. Step 3: e-mail verified; registration appears in Pending Approvals with consent date. | FR-01, FR-02, FR-03, FR-04, FR-05, FR-07, FR-21; BR-05, BR-08, BR-10, BR-11 | `apps/web/e2e/register-approve-login.spec.ts` "a BHW registers and sees the success screen" and "… lands on /me" (pending page before approval); `packages/types/src/schemas.test.ts` "registration requires consent and matching passwords" | Pass (automated, 2026-11-01) — dev project has "Confirm email" off; step 3 (verification link) is checked in production UAT once custom SMTP is set |
| TC-02 | Duplicate BHW ID | Seed BHW `BHW-KII-2019-001` exists | 1. On `/register`, enter BHW ID `bhw-kii-2019-001` (lower case) with a new e-mail. 2. Submit. | Pre-check returns `BHW_ID_TAKEN` (409): "This BHW ID number is already registered. Please check the number or contact the administrator." No account is created. | FR-02; BR-06 | `scripts/smoke-remote.mjs` "anon registration pre-check detects a taken BHW ID" | Pass (automated, 2026-11-01) |
| TC-03 | Profile photo type and size limits | `/register` open | 1. Attach a 6 MB JPG. 2. Attach a GIF. 3. Attach a 1 MB PNG. | 1: `FILE_TOO_LARGE` (413) "The file is too large. Photos and attachments must be 5 MB or smaller." 2: `FILE_TYPE_NOT_ALLOWED` (415). 3: accepted, stored in private bucket `profile-photos` under the user's own folder. | FR-06; BR-09, BR-95 | `apps/web/lib/registration-photo.test.ts` "rejects files over 5 MB with FILE_TOO_LARGE", "rejects other types with FILE_TYPE_NOT_ALLOWED", "accepts JPG, PNG and WebP up to 5 MB" | Pass (automated, 2026-11-01) |
| TC-04 | Approval with schedule | TC-01 registration verified and pending; admin signed in | 1. Admin opens Pending Approvals, clicks Approve without choosing a schedule. 2. Chooses "Regular Mon–Fri 08:00–17:00", effective today, approves. | 1: blocked with "Please choose a schedule first." (`SCHEDULE_REQUIRED`, 400). 2: status `active`, `employee_schedules` row from today, in-app notification (and e-mail when Resend is set), audit entry with the admin as actor; pending badge count drops by 1. | FR-21, FR-22, FR-24, FR-25, FR-26, FR-104; BR-12, BR-14 | `apps/web/components/employees/employee-helpers.test.ts` "needs a schedule and a YYYY-MM-DD effective date" (form only); `apps/web/e2e/register-approve-login.spec.ts` "an admin approves the registration and the BHW lands on /me" | Pass (automated, 2026-11-01) |
| TC-05 | Pending account cannot use the app | Registered, e-mail verified, status `pending` | 1. Log in on the mobile app. 2. Log in on the web. 3. Call `record-attendance` with the pending user's JWT. | 1: Blocked screen "waiting for approval" with "Check again"; no tabs, no scan. 2: redirected to `/pending`. 3: `ACCOUNT_NOT_ACTIVE` (403) "Your account is not active. Please wait for approval or contact the BHW office administrator." | FR-08, FR-34; BR-14, BR-16; AC-01 | `apps/mobile/__tests__/gate.test.ts` "blocks pending, rejected and inactive accounts"; `blocked.test.tsx` "lets a pending employee check again after approval"; `apps/web/lib/auth/guard.test.ts` "keeps pending users on /pending (AC-01 for the web)"; `handler.test.ts` "steps 4-15: ACCOUNT_NOT_ACTIVE from record_scan is returned with its HTTP status" | Pass (automated, 2026-11-01) |
| TC-06 | Rejected account | Admin rejected the registration with reason "BHW ID could not be verified with the roster." | 1. Admin rejects with reason "no" first, then with the full reason. 2. Applicant logs in on mobile. 3. Applicant logs in on web. | 1: "no" refused with `REASON_REQUIRED` "Please enter a reason of at least 10 characters."; full reason accepted, status `rejected`. 2: Blocked screen shows the administrator's reason; no "Check again". 3: kept on `/rejected`. | FR-08, FR-23, FR-24; BR-13, BR-14, BR-16; AC-01 | `apps/mobile/__tests__/blocked.test.tsx` "shows the administrator's rejection reason"; `gate.test.ts` "blocks pending, rejected and inactive accounts"; `apps/web/lib/auth/guard.test.ts` "keeps rejected users on /rejected"; `employee-helpers.test.ts` "requires a reason of at least 10 characters after trimming" | Pass (automated, 2026-11-01) |
| TC-07 | Inactive account | Active BHW deactivated by admin with a reason | 1. BHW opens the mobile app. 2. BHW tries to scan (API call). 3. BHW opens the web portal. | 1: Blocked screen "account not active". 2: `ACCOUNT_NOT_ACTIVE` (403). 3: signed out and sent back to login with the inactive message. | FR-15, FR-34; BR-14, BR-16; AC-01 | `apps/mobile/__tests__/gate.test.ts` "blocks pending, rejected and inactive accounts"; `apps/web/lib/auth/guard.test.ts` "sends inactive users back to login"; `02_record_scan.test.sql` "inactive employee cannot scan (AC-01)" | Pass (automated, 2026-11-01) |

### 1.2 Device binding

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-08 | First login binds the phone | Active BHW with no bound device | 1. Install the app, log in. | `bind-device` returns 200; `devices` row with `device_id_hash` (HMAC, no raw ID), platform, model, `bound_at`; app opens the tabs. | FR-27, FR-28, FR-29, FR-31; BR-20, BR-21, BR-22 | `scripts/smoke-functions.mjs` "unbound BHW binds a phone (or was bound by an earlier run)" | Pass (automated, 2026-11-01) |
| TC-09 | Wrong device | BHW bound to phone A | 1. Log in with the same account on phone B. 2. Scan a fresh kiosk QR from phone B. | 1: Blocked "another phone" state. 2: `DEVICE_MISMATCH` (403) "Your account is registered to a different phone. Please ask the administrator to reset your device." No action button; attempt logged. | FR-30, FR-34, FR-47; BR-21, BR-23 | `scripts/smoke-functions.mjs` "another phone → DEVICE_MISMATCH"; `apps/mobile/__tests__/scan-logic.test.ts` "flags a phone that is not the bound device"; `scan-result-overlay.test.tsx` "tells the employee to contact the admin for a device mismatch (no action button)" | Pass (automated, 2026-11-01) |
| TC-10 | Device reset | BHW bound to phone A which was lost | 1. Admin opens the employee, clicks Reset device, enters reason "Phone lost; new phone issued 2026-11-09." 2. Scan from phone A (if found). 3. Log in on phone B. | 1: `revoked_at` set on phone A; audit entry with reason; reason < 10 characters gives `REASON_REQUIRED`. 2: `DEVICE_NOT_BOUND` (403) "This phone is not yet registered to your account. Please log in again to register it." 3: phone B binds; device history shows both phones. | FR-32, FR-33; BR-24, BR-25, BR-62 | `02_record_scan.test.sql` "after a device reset the phone must bind again (step 5)"; `employee-helpers.test.ts` "resets a device only when an employee has an active binding" (button only) | Pending (pgTAP not yet executed) |

### 1.3 Kiosk station and device health

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-11 | Kiosk shows a rotating signed QR | Kiosk account signed in at `/kiosk/[stationId]` | 1. Watch the screen for 1 minute. | QR content starts with `BHWQR1:`, lifetime exactly 30 s, new QR every 15 s, countdown bar and Manila clock shown; the old QR is replaced before it expires. | FR-35, FR-36, FR-37, FR-38, FR-39, FR-43; BR-26, BR-27, BR-32 | `apps/web/e2e/kiosk.spec.ts` "shows a QR that refreshes with a countdown"; `scripts/smoke-functions.mjs` "kiosk issues a signed QR", "QR lifetime is 30 s" | Pass (automated, 2026-11-01) |
| TC-12 | Kiosk offline banner and recovery | Kiosk running | 1. Disconnect the kiosk's network for 30 s. 2. Reconnect. | 1: offline banner shown and the QR hidden (no stale QR on screen). 2: banner disappears, a new token is requested and a heartbeat sent immediately. | FR-41, FR-118; BR-32 | `apps/web/e2e/kiosk.spec.ts` "shows the offline banner and recovers on reconnect" | Pass (automated, 2026-11-01) |
| TC-13 | Kiosk offline alert on the admin dashboard | Kiosk online; admin on Dashboard / Device Health | 1. Close the kiosk browser (heartbeats stop). 2. Start a stopwatch; watch the dashboard device alerts. | Station shown "Offline" once 3 heartbeats (3 min) are missed, even before the minute job flips `is_online`; dashboard device alert appears within 3 minutes. | FR-100, FR-109, FR-110, FR-111, FR-148; BR-89, BR-90; AC-10 | `apps/web/components/monitoring/health.test.ts` "is offline once 3 heartbeats are missed, even before the job flips the flag", "is online when flagged and seen within 3 intervals"; `scripts/smoke-functions.mjs` "kiosk heartbeat accepted"; `04_corrections_dtr_jobs.test.sql` "kiosk silent for 4 minutes is marked offline (AC-10)" | Pass (automated, 2026-11-01) |
| TC-14 | Kiosk clock drift | Kiosk tablet clock set 45 s fast | 1. Let the kiosk send heartbeats. 2. Scan its QR from a bound phone. | Device Health shows a drift warning (above 30 s, either direction); the scan still succeeds because tokens and attendance use server time only. | FR-111, FR-114, FR-119; BR-02, BR-91 | `health.test.ts` "warns above 30 s either way"; `apps/web/components/kiosk/kiosk-utils.test.tsx` "ignores a wrong device clock" | Pass (automated, 2026-11-01) |
| TC-15 | Kiosk role limits | Signed in as `kiosk@bhw.local` | 1. Read `stations`, `profiles`, the live feed. 2. Open `/admin`. 3. Request a token for another station. | 1: exactly its own station and own profile; feed of its station only. 2: redirected (kiosk may open only `/kiosk/[stationId]`). 3: `FORBIDDEN` (403) "You do not have permission to do this." | FR-35, FR-40, FR-138, FR-139, FR-141; BR-17, BR-18 | `scripts/smoke-remote.mjs` "kiosk sees exactly its station", "kiosk reads its live feed"; `apps/web/lib/auth/routes.test.ts` "allows kiosk and admin on /kiosk/[stationId]"; `03_rls.test.sql` "kiosk sees only its own profile" | Pass (automated, 2026-11-01) |

### 1.4 Scanning (record-attendance, validation order of decisions §D)

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-16 | Valid time-in | Active, bound BHW at the office (≤ 100 m, GPS ≤ 50 m); no record today; Monday 07:52 | 1. Open Scan, scan the current kiosk QR. | HTTP 200, action `time_in`, status `on_time`, method `qr`; one `attendance_records` row; nonce marked used; success `scan_attempts` row; success overlay with badge and haptic, auto-dismiss after 4 s. | FR-46, FR-47, FR-52, FR-55, FR-56; BR-34, BR-39, BR-44 | `scripts/smoke-functions.mjs` "valid scan records time-in/out"; `handler.test.ts` "success returns the action and a friendly message"; `apps/mobile/__tests__/scan-result-overlay.test.tsx` "shows a successful time-in with status badge, success haptic and auto-dismiss after 4 s"; `02_record_scan.test.sql` "valid scan records time-in" | Pass (automated, 2026-11-01) |
| TC-17 | Valid time-out | TC-16 done at 07:52; now 17:03 (after cooldown) | 1. Scan the current kiosk QR. | HTTP 200, action `time_out`; `time_out` > `time_in`; `undertime_minutes = 0`; status stays `on_time`; a fourth scan the same day is TC-27. | FR-52, FR-53; BR-44, BR-46, BR-48, BR-54 | `02_record_scan.test.sql` "scan after the cooldown records time-out", "time-out is after time-in"; `01_status_logic.test.sql` "leaving after 17:00 gives 0 undertime" | Pending (pgTAP not yet executed) |
| TC-18 | Late time-in | Seed schedule (08:00, grace 15) | 1. Time in at 08:10. 2. Another BHW at 08:15:59. 3. Another BHW at 08:16. | 1: `on_time`, 0 late. 2: `on_time` (seconds truncated). 3: `late`, `minutes_late = 16` (counted from 08:00, not from the end of grace); app shows "Late – 16 min". | FR-53; BR-03, BR-45, BR-47, BR-48 | `01_status_logic.test.sql` "08:10 is on time within the 15-minute grace", "08:15:59 is on time (seconds truncated)", "08:16 is late by 16 minutes"; `apps/mobile/__tests__/scan-logic.test.ts` "warns for a late time-in and shows minutes" (display only) | Pending (pgTAP not yet executed) |
| TC-19 | Undertime | Time-in 08:00 | 1. Time out at 16:30. 2. Another BHW: time-in 08:30, time-out 16:45. | 1: `undertime`, `undertime_minutes = 30`. 2: status `late` with `minutes_late = 30` and `undertime_minutes = 15` both stored (status precedence). | FR-53; BR-46, BR-47 | `01_status_logic.test.sql` "leaving 16:30 gives 30 minutes undertime", "late and undertime: status late, both minutes stored" | Pending (pgTAP not yet executed) |
| TC-20 | Expired QR | Bound BHW at the office | 1. Point the camera at the kiosk, pause the app on the decoded token for 31 s (or replay a captured token after 31 s). 2. Submit. | `QR_EXPIRED` (400) "This QR code has expired. Please scan the newest QR code on the screen."; failed `scan_attempts` row; no attendance change. | FR-48; BR-27, BR-34, BR-39; AC-02 | `handler.test.ts` "step 7: screenshot older than 30 s -> tokenExpired=true", "QR_INVALID and QR_EXPIRED from record_scan map to 400"; `02_record_scan.test.sql` "expired token is rejected (step 7, AC-02)" | Pass (automated, 2026-11-01) |
| TC-21 | Reused QR | TC-16 succeeded with token T | 1. Submit token T again (same user, still within 30 s). | `QR_REUSED` (409) "You have already used this QR code. Please wait for the next QR code and scan again." | FR-47; BR-30; AC-03 | `scripts/smoke-functions.mjs` "same QR again → QR_REUSED (AC-03)"; `02_record_scan.test.sql` "same QR cannot be used twice by the same user (step 9, AC-03)" | Pass (automated, 2026-11-01) |
| TC-22 | Screenshot replay | A co-worker photographs the kiosk QR and sends it to a BHW at home 330 m away | 1. Home BHW scans the photo within 30 s. 2. Scans it again after 31 s. 3. A token whose `iat` is more than 5 s in the future (tampered) is submitted. | 1: `OUTSIDE_GEOFENCE` (403). 2: `QR_EXPIRED` (400). 3: `QR_EXPIRED` (400). No attendance written in any case; attempts logged. | FR-48, FR-58; BR-27, BR-28, BR-37, BR-41; AC-02 | `handler.test.ts` "step 7: screenshot older than 30 s -> tokenExpired=true", "step 7: iat too far in the future -> tokenExpired=true"; `scripts/smoke-functions.mjs` "scan 330 m away → OUTSIDE_GEOFENCE 403" | Pass (automated, 2026-11-01) |
| TC-23 | Forged or unknown QR | Bound BHW at the office | 1. Scan a random QR (not `BHWQR1:`). 2. Submit a kiosk token with the last 4 signature characters changed. 3. Submit a correctly signed token whose nonce was never issued. 4. Submit a token signed with the previous secret during rotation. | 1: app ignores it (only `BHWQR1:` content accepted). 2: `QR_INVALID` (400) "This QR code is not valid. Please scan a QR code from the BHW attendance system." 3: `QR_UNKNOWN` (400). 4: accepted (60 s rotation overlap). | FR-42, FR-46, FR-47, FR-49; BR-26, BR-29, BR-31 | `scripts/smoke-functions.mjs` "forged QR → QR_INVALID"; `handler.test.ts` "step 6: forged signature -> tokenValid=false passed to record_scan", "previous secret is accepted during rotation", "steps 4-15: QR_UNKNOWN from record_scan is returned with its HTTP status"; `packages/types/src/schemas.test.ts` "scan request requires the kiosk prefix" | Pass (automated, 2026-11-01) |
| TC-24 | Outside geofence | Bound BHW about 330 m north of the station, GPS accuracy 10 m | 1. Scan a fresh kiosk QR (shared live by video call, or by walking away within 30 s). | `OUTSIDE_GEOFENCE` (403) "You are about {distance} m from the office. Please move closer to the BHW office (within 100 m) and scan again." with distance ≈ 333 and radius 100 filled in, in English or Filipino; error haptic and Retry action. | FR-47, FR-56; BR-37; AC-04 | `scripts/smoke-functions.mjs` "scan 330 m away → OUTSIDE_GEOFENCE 403"; `handler.test.ts` "steps 4-15: OUTSIDE_GEOFENCE from record_scan is returned with its HTTP status"; `apps/mobile/__tests__/scan-result-overlay.test.tsx` "shows a friendly geofence error in both languages with a retry action and error haptic"; `scan-logic.test.ts` "fills geofence parameters in both languages" | Pass (automated, 2026-11-01) |
| TC-25 | Poor GPS | Bound BHW indoors, GPS accuracy 120 m | 1. Open Scan. 2. Force a scan request with accuracy 120. | 1: pre-scan check warns with the measured accuracy. 2: `GPS_INACCURATE` (400) "Your location is not accurate enough (120 m; 50 m or better is needed). Please move near a window or outside, wait a few seconds, and try again." | FR-45, FR-50; BR-36 | `scripts/smoke-functions.mjs` "scan with 120 m GPS accuracy → GPS_INACCURATE"; `apps/mobile/__tests__/scan-logic.test.ts` "flags poor GPS accuracy with the measured value" | Pass (automated, 2026-11-01) |
| TC-26 | Duplicate scan (cooldown) | Time-in recorded at 07:52 | 1. At 07:54 scan the next kiosk QR. | `COOLDOWN_ACTIVE` (429) "Your last scan was recorded at 07:52. You can scan again at 07:57."; no time-out recorded. | FR-51; BR-38; D-20 | `02_record_scan.test.sql` "second scan within 5 minutes hits the cooldown (step 13)"; `handler.test.ts` "steps 4-15: COOLDOWN_ACTIVE from record_scan is returned with its HTTP status" (status mapping only) | Pending (pgTAP not yet executed) |
| TC-27 | Third scan of a completed day | Time-in and time-out already recorded today | 1. Scan again after the cooldown. | `ALREADY_COMPLETED` (409) "Your time-in and time-out for today are already recorded. If something is wrong, please file a correction request."; overlay offers "Request correction". | FR-52; BR-54 | `02_record_scan.test.sql` "third scan of the day is rejected (step 14)"; `apps/mobile/__tests__/scan-result-overlay.test.tsx` "offers a correction request when the day is already complete" (display only) | Pending (pgTAP not yet executed) |
| TC-28 | Rate limiting | Bound BHW | 1. Send 11 scan requests within one minute. | Requests 1–10 are processed normally; the 11th returns `RATE_LIMITED` (429) "Too many attempts. Please wait one minute, then try again." | FR-47; BR-35 | `handler.test.ts` "step 2: RATE_LIMITED after 10 attempts in a minute (429)" | Pass (automated, 2026-11-01) |
| TC-29 | Expired session / no login | No JWT, or an expired one | 1. Call `record-attendance` without the Authorization header. | `AUTH_REQUIRED` (401) "Your session has ended. Please log in again."; attempt logged. | FR-137, FR-141; BR-34 | `scripts/smoke-functions.mjs` "scan without login → AUTH_REQUIRED 401"; `handler.test.ts` "step 1: AUTH_REQUIRED without a JWT (401, attempt logged)" | Pass (automated, 2026-11-01) |
| TC-30 | Inactive station and selfie setting | Bound BHW at the office | 1. Admin deactivates the station; BHW scans a token issued just before. 2. Reactivate; admin sets `selfie_required = true`; BHW scans without a selfie. | 1: `STATION_INACTIVE` (400) "This attendance station is not active. Please contact the administrator." 2: `SELFIE_REQUIRED` (400) "A selfie is required for this scan. Please allow the front camera and try again." | FR-57, FR-108, FR-132; BR-42 | `02_record_scan.test.sql` "inactive station is rejected (step 10)", "selfie required when the setting is on (step 15)" | Pending (pgTAP not yet executed) |
| TC-31 | Overnight time-out | BHW timed in Monday 2026-11-09 at 20:00 (night vaccination drive), no time-out | 1. Scan on Tuesday 2026-11-10 at 02:30. 2. Scan again at 04:30. | 1: becomes the **2026-11-09** time-out (before the 04:00 cutoff, previous day open). 2: new 2026-11-10 time-in. The end-of-day job at 04:05 does not mark 2026-11-09 incomplete. | FR-52, FR-146; BR-43, BR-44; D-13 | Manual (no automated test covers the cutoff path) | Pending (manual UAT) |
| TC-32 | Holiday and non-working day | Holiday "Bonifacio Day" on Monday 2026-11-30; Saturday 2026-11-28 | 1. BHW scans in at 09:30 and out at 12:00 on the holiday. 2. Another BHW scans on Saturday. 3. Run the end-of-day job for both dates. | 1: `on_time`, `minutes_late = 0`, `undertime_minutes = 0`, notes "Bonifacio Day". 2: `on_time`, notes "Non-working day". 3: no `absent` rows created for those dates. | FR-54, FR-106, FR-146; BR-49, BR-55 | `01_status_logic.test.sql` "holiday scans are on time with the holiday name", "Saturday scans are non-working day"; `apps/web/components/setup/holidays.test.ts` "has the ten regular holidays on valid, unique 2026 dates" (preset list only) | Pending (pgTAP not yet executed) |

### 1.5 Mobile app behaviour

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-33 | Pre-scan health check | Bound BHW | 1. Turn off camera permission, open Scan. 2. Turn off location permission. 3. Turn off GPS. | 1: `CAMERA_DENIED` "Camera access is turned off. Please allow the camera in your phone settings so you can scan." 2: `LOCATION_DENIED`. 3: `LOCATION_UNAVAILABLE` "We cannot get your location. Please turn on GPS/Location and try again." Scan not sent. | FR-45; BR-36 | `apps/mobile/__tests__/scan-logic.test.ts` "flags denied camera and location", "flags location services off", "is ready when everything is ok" | Pass (automated, 2026-11-01) |
| TC-34 | Offline mobile – no scan queue | Bound BHW; airplane mode on | 1. Open Home. 2. Try to scan. 3. Turn the internet back on. | 1: snackbar "You are offline". 2: scan button disabled; `OFFLINE` message "You are offline. Please connect to the internet and scan again. Scans are not saved while offline."; nothing is stored for later. 3: scan button enabled again; nothing is auto-sent. | FR-59; BR-40 | `apps/mobile/__tests__/home.test.tsx` "disables scanning while offline (scans are never queued)"; `scan-logic.test.ts` "flags offline and does not check the device while offline" | Pass (automated, 2026-11-01) |
| TC-35 | Offline history and re-sync | Bound BHW who opened History, My DTR and My Requests once online | 1. Turn on airplane mode, open the three screens. 2. Admin approves a correction meanwhile. 3. Reconnect. 4. Sign out. | 1: cached data shown with an offline note. 3: data re-fetched; approved correction visible. 4: caches, offline snapshots and cached profile cleared from the phone. | FR-115, FR-140 | Manual (real phone) | Pending (manual UAT) |
| TC-36 | Biometric unlock | Phone with fingerprint enrolled; "Biometric unlock" on in Profile & Settings | 1. Tap Scan, use the correct finger. 2. Cancel the prompt. 3. Use the phone passcode. | 1: scan screen opens. 2: `BIOMETRIC_FAILED` toast "Fingerprint or Face ID check did not succeed. Please try again or use your phone's passcode."; scan screen stays locked. 3: opens. No fingerprint data is sent or stored by the system. | FR-44, FR-135; BR-94; D-30 | `apps/mobile/__tests__/home.test.tsx` "asks for the phone biometric first and shows a gluestack toast when it fails" (Jest passed; real sensor not yet tried) | Pending (manual UAT) |
| TC-37 | Real phone scan at the office, response time | Android phone with release build, at the BHW office, 4G or office Wi-Fi | 1. Scan the kiosk QR; time from capture to result overlay with a stopwatch, 5 tries across BHWs. | Result overlay within 3 s each time; correct Manila time shown; kiosk live feed shows the scan. | FR-40, FR-46, FR-56; NFR scan response < 3 s | Manual (real phone) | Pending (manual UAT) |

### 1.6 Fallback and manual entry

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-38 | Personal QR on the phone | Active, bound BHW | 1. Open the My QR tab. 2. Set the phone clock 2 minutes wrong and watch the countdown. | Rotating code starting `BHWPQR1:` issued by `issue-personal-qr`; countdown follows server time even with a wrong phone clock; refreshes before expiry. On an unbound phone: `DEVICE_MISMATCH`. | FR-62; BR-58 | `scripts/smoke-functions.mjs` "personal fallback QR issued on the bound phone"; `apps/mobile/__tests__/qr-countdown.test.ts` "counts down to the next refresh on server time even when the phone clock is wrong", "never refreshes later than the token expiry" | Pass (automated, 2026-11-01) |
| TC-39 | Admin fallback scan (kiosk down) | Kiosk offline; admin on Fallback Scan page with webcam; BHW shows My QR | 1. Admin selects the station, enters reason "Kiosk tablet not charging this morning.", scans the BHW's code. 2. Scans the same code again. 3. Scans a screenshot of the code 31 s later. | 1: record with method `fallback_personal_qr`, `created_by` = admin, station chosen, status computed normally, audit entry with the reason. 2: `QR_REUSED` (409). 3: `QR_EXPIRED` (400). Cooldown also applies. | FR-63, FR-64, FR-66; BR-58, BR-59, BR-61, BR-62, BR-92; AC-07 | `apps/web/components/attendance/scan-gate.test.tsx` "accepts personal QR content only" (camera gate only); recording path manual | Pending (manual UAT) |
| TC-40 | Manual entry | Admin on Manual Entry page; BHW Maria Santos has no record on Monday 2026-11-09 | 1. Enter 08:20 – 17:00 with reason "short". 2. Enter a time later than now. 3. Enter time-out 08:00, time-in 08:20. 4. Enter 08:20 – 17:00 with reason "Phone battery died; verified by the BHW president." | 1: `REASON_REQUIRED` (400). 2: `FUTURE_TIME_NOT_ALLOWED` (400). 3: `INVALID_TIME_RANGE` (400). 4: record method `manual`, `minutes_late = 20`, status `late`, `created_by` = admin. | FR-65, FR-67; BR-60, BR-61 | `04_corrections_dtr_jobs.test.sql` "manual entry requires a reason", "manual entry with reason"; `01_status_logic.test.sql` "manual entries need a reason of 10+ characters and a time-in"; `packages/types/src/schemas.test.ts` "manual entry needs a reason and a valid range" (no run recorded) | Pending (pgTAP not yet executed) |
| TC-41 | Audit trail of manual entry | TC-40 step 4 done | 1. Admin opens Audit Log, filters table `attendance_records`, today. | Entry with action for the manual insert, actor = admin, the full reason, old/new values; the entry cannot be edited or deleted by any role. | FR-66, FR-126, FR-127, FR-128, FR-129; BR-62, BR-96; AC-07 | `04_corrections_dtr_jobs.test.sql` "manual entry reason is in the audit log (AC-07)" | Pending (pgTAP not yet executed) |

### 1.7 Correction requests and the end-of-day job

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-42 | File a correction request | BHW with an `incomplete` record yesterday | 1. In History, tap the day → Request correction, type `missing_time_out`, time 17:05, reason "Forgot to scan out after the barangay feeding program.", attach a 1 MB photo. 2. File a second request for the same date. 3. File one for a date two months back. | 1: request `pending`; attachment in private bucket `correction-attachments`; appears in My Requests and on the admin Correction Requests page. 2: `CORRECTION_DUPLICATE` (409). 3: `CORRECTION_NOT_ELIGIBLE` (422) "This date can no longer be corrected through the app. Please talk to the administrator." | FR-68, FR-69, FR-70, FR-71, FR-73; BR-63, BR-64, BR-65, BR-66 | `04_corrections_dtr_jobs.test.sql` "employee files a correction", "one pending request per date", "old dates are not eligible"; `apps/mobile/__tests__/correction-eligibility.test.ts` "accepts last month only while today <= correction_window_days", "requires the time that matches the type and a 10-character reason", "accepts images and PDFs up to 5 MB only" (client checks) | Pending (pgTAP not yet executed) |
| TC-43 | Correction request approved | TC-42 request pending | 1. Admin opens the request, reviews the before/after comparison, approves. 2. BHW opens History and My DTR. | Record time-out 17:05, method `correction`, status recomputed (`on_time`); request `approved`; in-app notification (and e-mail if configured); audit entry `approve_correction` with the admin as actor; DTR PM Departure shows 5:05 with no manual refresh. | FR-74, FR-76, FR-77, FR-85; BR-68, BR-71, BR-80; AC-07, AC-08 | `04_corrections_dtr_jobs.test.sql` "admin approves the correction", "approved correction updates the record (AC-08)", "DTR shows the corrected time-out (AC-08)", "correction is in the audit log with the admin as actor (AC-07)"; `apps/web/components/attendance/correction-compare.test.tsx` "missing_time_out keeps the time-in and sets the time-out" (preview only) | Pending (pgTAP not yet executed) |
| TC-44 | Correction request rejected | Another pending request | 1. Admin rejects with remarks "no". 2. Rejects with "Logbook shows no field activity that day." 3. Tries to approve the same request. | 1: `REASON_REQUIRED` (400). 2: request `rejected`, attendance record unchanged, BHW sees the remarks and no Cancel button. 3: `REQUEST_NOT_PENDING` (409) "This request has already been processed and can no longer be changed." | FR-74, FR-76, FR-77; BR-70, BR-71 | `04_corrections_dtr_jobs.test.sql` "rejection needs remarks"; `apps/mobile/__tests__/dtr-table.test.tsx` "shows admin remarks and no cancel button once reviewed" (display only) | Pending (pgTAP not yet executed) |
| TC-45 | Missing time-in correction also applies its time-out | BHW marked `absent` on Monday 2026-11-09 (was at a home-visit, did not scan); migration `20261101000800_fix_corrections_and_approvals.sql` applied | 1. File `missing_time_in` with time-in 08:05 and time-out 17:00, reason "Home visits in Purok Masagana; no kiosk access." 2. Admin approves. | Record has time-in 08:05 **and** time-out 17:00, method `correction`, status `on_time`; DTR row shows both times and no "Absent" remark; one request fixed the whole day. | FR-74, FR-85; BR-63, BR-68; AC-08 | `apps/web/components/attendance/correction-compare.test.tsx` "applies the time-out of a missing time-in request, fixing an absent day in one request (BR-63)" (web preview mirror; the database path has no run test) | Pending (manual UAT) |
| TC-46 | Forgotten time-out → incomplete → correction | BHW timed in Monday 08:00, no time-out | 1. Let the end-of-day job run at 04:05 Tuesday (or call `run_end_of_day` for Monday). 2. BHW files `missing_time_out` 17:00. 3. Admin approves. | 1: Monday record status `incomplete`, in-app notification to the BHW; DTR shows "No time-out". 2–3: status recomputed to `on_time`, DTR shows 5:00 PM Departure. | FR-145, FR-146, FR-68, FR-74; BR-55, BR-56, BR-57, BR-77 | `04_corrections_dtr_jobs.test.sql` "end-of-day job runs", "forgotten time-out becomes incomplete", plus the approval assertions listed in TC-43 | Pending (pgTAP not yet executed) |
| TC-47 | End-of-day absent marking | Active BHW with schedule, no scan on a work day | 1. Run the job for that date. 2. Run it again. | 1: `absent` row inserted for every scheduled active employee without a record (not on holidays or non-work days). 2: no duplicates (idempotent). | FR-146, FR-151; BR-55 | `04_corrections_dtr_jobs.test.sql` "end-of-day job leaves a record for every scheduled employee", "end-of-day job is idempotent"; `01_status_logic.test.sql` "no time-in is absent" | Pending (pgTAP not yet executed) |

### 1.8 DTR and reports

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-48 | DTR follows the CSC Form No. 48 layout | Seeded month with records | 1. Admin opens DTR for Maria Santos, current month. 2. BHW opens My DTR on the phone. | 31 day rows; AM Arrival / Departure, PM Arrival / Departure, Undertime hours/minutes; "Regular days" and "Saturdays" lines; weekend and holiday labels; certification text, employee signature, "Verified as to the prescribed office hours:" and in-charge line; same layout on web and mobile in English and Filipino. | FR-78, FR-79, FR-81, FR-84; BR-72, BR-73, BR-74, BR-75, BR-79; AC-09 | `apps/web/components/dtr/dtr-utils.test.tsx` "renders the CSC Form 48 header, 31 rows, spanning remarks and the TOTAL line"; `scripts/smoke-remote.mjs` "employee reads own DTR with 31 rows"; `apps/mobile/__tests__/dtr-table.test.tsx` "renders all 31 CSC Form 48 lines with times, undertime and spanning remarks"; `04_corrections_dtr_jobs.test.sql` "DTR has 31 rows" | Pass (automated, 2026-11-01) |
| TC-49 | DTR totals match the records | Month with late, undertime and absent days | 1. Sum `minutes_late + undertime_minutes` per day from Attendance Records, add full scheduled minutes (480) for each absent work day. 2. Compare with the DTR TOTAL line. | DTR undertime total equals the computed sum exactly; each daily cell equals that day's value; TOTAL equals the sum of the 31 rows. | FR-80, FR-85; BR-76, BR-77, BR-78; AC-09 | `04_corrections_dtr_jobs.test.sql` "DTR undertime total equals lateness + undertime + absent days (AC-09)"; `dtr-utils.test.tsx` "TOTAL equals the sum of the 31 rows" (client sum only) | Pending (pgTAP not yet executed) |
| TC-50 | PDF DTR download and batch DTR | Admin and BHW signed in | 1. BHW taps Download PDF in My DTR. 2. Admin runs batch DTR for all active employees for the month. | 1: `generate-dtr-pdf` returns `application/pdf` (file begins `%PDF`), file named per employee and month, footer "In Charge" line on the page. 2: 8 DTR documents, one per active BHW, printable on A4 or legal. | FR-82, FR-83, FR-84; BR-79 | `scripts/smoke-functions.mjs` "DTR PDF generated"; `scripts/smoke-remote.mjs` "batch DTR returns 8 documents"; `dtr-utils.test.tsx` "names PDF files per employee or batch" | Pass (automated, 2026-11-01) |
| TC-51 | Monthly report totals | Seeded month | 1. Admin opens Reports → Monthly. 2. Add up each column of the rows. 3. Export CSV and PDF. | Every active employee listed; the totals row equals the sum of the rows; late count equals the raw records; CSV opens in Excel with "ñ" preserved and Manila `YYYY-MM-DD HH:mm` times. | FR-88, FR-90, FR-91, FR-92; BR-78, BR-81, BR-85, BR-87; AC-06 | `apps/web/e2e/reports.spec.ts` "monthly report lists every employee and totals add up"; `scripts/smoke-remote.mjs` "monthly summary returns 8 rows"; `apps/web/lib/csv.test.ts` "quotes commas and quotes, keeps ñ, and neutralises formulas"; `04_corrections_dtr_jobs.test.sql` "monthly late count equals the raw records (AC-06)" | Pass (automated, 2026-11-01) |
| TC-52 | Daily and weekly report totals equal the raw records | Seeded week | 1. Open the Daily report for Monday and the Weekly report for that week. 2. Open Attendance Records filtered to the same dates and count by status by hand. | Present (any record with time-in), late, undertime, absent and incomplete counts and minute totals are identical in both places; incomplete counted as present and also on its own. | FR-86, FR-87, FR-92, FR-94; BR-81, BR-82, BR-83, BR-84, BR-85; AC-06 | `apps/web/components/reports/report-utils.test.tsx` "counts the displayed rows by status, NULL as no record", "per-day counts agree with the per-employee day columns"; `scripts/smoke-remote.mjs` "viewer reads the daily report (8 BHWs)" (row count only); comparison with raw records is manual | Pending (manual UAT) |

### 1.9 Dashboard, roles, security and error logging

| ID | Scenario | Preconditions | Steps | Expected result | Covers | Automated by | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-53 | Dashboard updates within 2 seconds | Admin dashboard open on a laptop beside the kiosk; BHW ready to scan | 1. Start a stopwatch when the phone shows the success overlay. 2. Stop when the dashboard live scan list and Present card change. Repeat 5 times. | Every update appears within 2 s, without reloading the page. | FR-95, FR-97, FR-98; AC-05 | `apps/web/e2e/dashboard-latency.spec.ts` (PERF=1): time from the successful scan response to the scan appearing in the live list | Pass (automated, 2026-11-01): 471 ms and 359 ms for the live scan list; the stat cards follow with the background refresh (~2.6 s on the eu-west-1 dev project) — repeat the stopwatch check on production (Singapore) during UAT |
| TC-54 | Viewer read-only | Signed in as `viewer@bhw.local` | 1. Open the viewer dashboard and reports. 2. Try to read `attendance_records` directly, open `/admin`, and scan from the mobile app. | 1: stat cards, charts and reports visible; no create/edit/approve buttons; admin-only counts (pending corrections) hidden. 2: zero rows; redirected away from `/admin`; viewer cannot scan (`ACCOUNT_NOT_ACTIVE`). | FR-93, FR-101, FR-139; BR-17, BR-88 | `scripts/smoke-remote.mjs` "viewer has no direct attendance access", "viewer reads the daily report (8 BHWs)", "viewer dashboard hides admin-only counts"; `apps/web/e2e/pages.spec.ts` "viewer pages render"; `apps/web/lib/auth/routes.test.ts` "allows viewer and admin on /viewer"; `apps/mobile/__tests__/gate.test.ts` "blocks non-employee roles" | Pass (automated, 2026-11-01) |
| TC-55 | Employee data isolation | Signed in as `maria.santos@bhw.local` | 1. Read `profiles` and `attendance_records`. 2. Insert an attendance row directly. 3. Call a report RPC and an admin RPC. | 1: only her own profile and records. 2: refused (no insert policy). 3: `FORBIDDEN`. | FR-61, FR-138, FR-139, FR-141; BR-17, BR-18, BR-19 | `scripts/smoke-remote.mjs` "employee sees only own profile", "employee sees own attendance only", "employee cannot insert attendance (FR-61)", "employee cannot run reports", "employee cannot call admin RPCs" | Pass (automated, 2026-11-01) |
| TC-56 | Encryption at rest | Seed BHW with contact number 09171234501 | 1. As database owner, `select contact_number_enc, address_enc from profiles`. 2. As the BHW, call `get_profile_private`. 3. As another BHW, call it for her. 4. Admin edits the contact number; open the audit entry. | 1: `bytea` ciphertext, not readable text. 2: plain "09171234501". 3: no data. 4: audit shows "[changed]", never the value. | FR-07, FR-12, FR-130; BR-93, BR-96; AC-12 | `04_corrections_dtr_jobs.test.sql` "contact number is encrypted at rest (AC-12)"; `03_rls.test.sql` "employee cannot decrypt another contact number"; `scripts/smoke-remote.mjs` "employee decrypts own contact number" (decrypt path only); `apps/web/components/monitoring/audit-diff.test.ts` "reports redacted encrypted columns as changed" | Pending (pgTAP not yet executed) |
| TC-57 | No biometric data is stored | Schema and storage buckets deployed | 1. List all table columns and storage buckets. 2. Enable biometric unlock on a phone, use it, then inspect the `devices` row and network calls. | No column or bucket holds fingerprint, face template or biometric result; only `device_id_hash`, platform and model are stored; biometric check never leaves the phone. | FR-44; BR-94; D-30; AC-12 | Manual (schema review plus real phone) | Pending (manual UAT) |
| TC-58 | Error logged (Edge Function and mobile) | Admin on Error Logs page | 1. Trigger an unexpected Edge Function error (database unavailable). 2. Mobile app sends an error through `log-error`. | 1: `INTERNAL_ERROR` (500) "Something went wrong on our side. Please try again. If it keeps happening, please tell the administrator." and an `error_logs` row (source `edge_function`). 2: `error_logs` row (source `mobile`) with severity and context, no tokens, passwords or raw device IDs; both visible and filterable on Error Logs. | FR-120, FR-121, FR-122, FR-123, FR-125; BR-98; AC-11 | `handler.test.ts` "INTERNAL_ERROR when the database call throws (500, error logged)"; `scripts/smoke-functions.mjs` "log-error stores a mobile error" | Pass (automated, 2026-11-01) |
| TC-59 | Kiosk errors appear in Error Logs | Kiosk running; admin on Error Logs | 1. Make `issue-qr-token` fail on the kiosk (e.g. sign out the kiosk account in another tab). 2. Stop the kiosk for 4 minutes. | 1: `error_logs` row with source `kiosk`. 2: critical row "Kiosk offline: BHW Office – Main Entrance missed 3 heartbeats" and an admin notification. | FR-110, FR-120, FR-123; BR-90; AC-10, AC-11 | Manual (`04_corrections_dtr_jobs.test.sql` "kiosk silent for 4 minutes is marked offline (AC-10)" checks the flag only, not the log row) | Pending (manual UAT) |

### 1.10 Result totals

| Result | Count | Test cases |
| --- | --- | --- |
| Pass (automated, 2026-11-01) | 33 | TC-01, 02, 03, 04, 05, 06, 07, 08, 09, 11, 12, 13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 28, 29, 33, 34, 38, 48, 50, 51, 53, 54, 55, 58 |
| Pending (pgTAP not yet executed) | 17 | TC-10, 17, 18, 19, 26, 27, 30, 32, 40, 41, 42, 43, 44, 46, 47, 49, 56 |
| Pending (manual UAT) | 9 | TC-31, 35, 36, 37, 39, 45, 52, 57, 59 |
| **Total** | **59** | |

## 2. Acceptance criteria coverage

| AC | Acceptance criterion | Test cases | Status |
| --- | --- | --- | --- |
| AC-01 | A pending user cannot use the mobile app. | TC-05, TC-06, TC-07 | Pass (automated, 2026-11-01); confirm on a real phone during UAT task 3 |
| AC-02 | A kiosk QR screenshot older than 30 seconds is rejected. | TC-20, TC-22 | Pass (automated, 2026-11-01) |
| AC-03 | The same QR cannot be used twice by the same user. | TC-21, TC-39 | Pass (automated, 2026-11-01) for the kiosk QR; personal QR reuse in TC-39 pending manual UAT |
| AC-04 | Scans outside the geofence are rejected with a clear message. | TC-24, TC-22 | Pass (automated, 2026-11-01) |
| AC-05 | The admin dashboard updates within 2 seconds of a successful scan. | TC-53 | Pass (live scan list 359–471 ms, automated); stat cards confirm in UAT |
| AC-06 | Daily/weekly/monthly reports match the raw records exactly. | TC-51, TC-52 | Partial: monthly Pass (automated, 2026-11-01); daily/weekly Pending (manual UAT) |
| AC-07 | Every manual correction appears in the audit log with a reason. | TC-41, TC-43, TC-39 | Pending (pgTAP not yet executed); fallback audit Pending (manual UAT) |
| AC-08 | An approved correction request updates the attendance record and the DTR automatically. | TC-43, TC-45, TC-46 | Pending (pgTAP not yet executed); TC-45 Pending (manual UAT) |
| AC-09 | The generated DTR follows the CSC Form 48 layout and its totals (including undertime) match the records. | TC-48, TC-49, TC-50 | Partial: layout and PDF Pass (automated, 2026-11-01); totals vs records Pending (pgTAP not yet executed) |
| AC-10 | A kiosk that stops sending heartbeats is shown as offline on the dashboard within 3 minutes. | TC-13, TC-12, TC-59 | Pass (automated, 2026-11-01) for the dashboard status; offline log row Pending (manual UAT) |
| AC-11 | Errors from Edge Functions, kiosk and mobile app appear in Error Logs. | TC-58, TC-59 | Partial: Edge Function and mobile Pass (automated, 2026-11-01); kiosk Pending (manual UAT) |
| AC-12 | Sensitive profile fields are encrypted at rest and no biometric data is stored. | TC-56, TC-57 | Pending (pgTAP not yet executed) and Pending (manual UAT) |

To close the pending items: (1) run `pnpm db:test:remote` with `supabase/.env.test.local` and `supabase/prod-ca-2021.crt` in place, and update the 17 pgTAP results; (2) run the 9 manual cases on the kiosk tablet and at least two Android phones during the UAT session below; (3) on production, with custom SMTP and "Confirm email" on, register once by hand and open the verification link (TC-01 step 3).

---

## 3. UAT form (printable)

> Print one copy per tester. Para sa bawat tester, mag-print ng isang kopya.

**BHW QR Attendance System – User Acceptance Test**
**Barangay Kalawag II Health Workers (BHW) Office**

| Field | Answer |
| --- | --- |
| Tester name / Pangalan ng tester | ______________________________ |
| Role / Tungkulin (check one) | ☐ BHW  ☐ Admin  ☐ Management (Punong Barangay, Kagawad, BHW President, viewer) |
| Date / Petsa | ______________________________ |
| Phone or device model / Modelo ng telepono o device | ______________________________ |
| Android version / Bersyon ng Android | ______________________________ |
| Facilitator / Tagapangasiwa | ______________________________ |

### 3.1 Instructions / Mga tagubilin

**English**

1. Do only the tasks marked for your role (BHW, Admin or Management). Skip the others.
2. Try each task on your own first. The facilitator will only help if you ask.
3. After each task, circle one number for the statement **"This task was easy to do."**
4. Tick **Yes** if you finished the task without any help, **No** if you needed help or could not finish.
5. Write any problem, confusing word or suggestion in the Comments column.
6. There are no wrong answers. We are testing the system, not you.

**Filipino**

1. Gawin lamang ang mga gawaing para sa iyong tungkulin (BHW, Admin o Management). Laktawan ang iba.
2. Subukan munang gawin nang mag-isa ang bawat gawain. Tutulong lamang ang facilitator kapag humingi ka ng tulong.
3. Pagkatapos ng bawat gawain, bilugan ang isang numero para sa pahayag na **"Madaling gawin ang gawaing ito."**
4. Lagyan ng tsek ang **Oo** kung natapos mo ang gawain nang walang tulong, **Hindi** kung kinailangan mo ng tulong o hindi mo natapos.
5. Isulat sa hanay ng Komento ang anumang problema, nakalilitong salita o mungkahi.
6. Walang maling sagot. Ang sistema ang sinusubok, hindi ikaw.

**Rating scale / Antas ng pagsang-ayon**

| Number | English | Filipino |
| --- | --- | --- |
| 1 | Strongly disagree | Lubos na hindi sang-ayon |
| 2 | Disagree | Hindi sang-ayon |
| 3 | Neutral | Walang kinikilingan |
| 4 | Agree | Sang-ayon |
| 5 | Strongly agree | Lubos na sang-ayon |

### 3.2 Tasks / Mga gawain

Statement for every task: **"This task was easy to do." / "Madaling gawin ang gawaing ito."**

| # | Task / Gawain | For | Rating (circle one) | Completed without help? | Comments / Komento |
| --- | --- | --- | --- | --- | --- |
| 1 | Register on the website and agree to the Data Privacy notice. / Magparehistro sa website at sumang-ayon sa Data Privacy notice. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 2 | Approve a registration and choose the BHW's schedule. / Aprubahan ang isang rehistro at piliin ang schedule ng BHW. | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 3 | Log in on the phone app and register your phone. / Mag-login sa app sa telepono at irehistro ang iyong telepono. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 4 | Scan the QR code on the office screen to time in. / I-scan ang QR code sa screen ng opisina para mag-time in. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 5 | Scan again in the afternoon to time out. / Mag-scan muli sa hapon para mag-time out. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 6 | Understand what to do when a scan does not work (for example, too far from the office). / Maintindihan ang dapat gawin kapag hindi tumuloy ang scan (halimbawa, malayo sa opisina). | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 7 | Unlock the scan screen with your fingerprint (if your phone has one). / Buksan ang scan screen gamit ang iyong fingerprint (kung mayroon ang telepono). | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 8 | Check your attendance for this week on the phone. / Tingnan ang iyong attendance ngayong linggo sa telepono. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 9 | Request a correction for a day you forgot to time out. / Mag-request ng pagtatama para sa araw na nakalimutan mong mag-time out. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 10 | Approve or reject a correction request with remarks. / Aprubahan o tanggihan ang correction request na may remarks. | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 11 | Show your personal QR on the phone when the office screen is not working. / Ipakita ang iyong personal QR sa telepono kapag sira ang screen ng opisina. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 12 | Scan a BHW's personal QR on the Fallback Scan page. / I-scan ang personal QR ng BHW sa Fallback Scan page. | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 13 | Enter a BHW's time-in and time-out by hand, with a reason. / Ilagay nang mano-mano ang time-in at time-out ng BHW, kasama ang dahilan. | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 14 | Open your DTR on the phone and download the PDF. / Buksan ang iyong DTR sa telepono at i-download ang PDF. | BHW | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 15 | Print the DTR (CSC Form 48) of all BHWs for the month. / I-print ang DTR (CSC Form 48) ng lahat ng BHW para sa buwan. | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 16 | See today's present, late and absent counts on the dashboard. / Tingnan sa dashboard ang bilang ng present, late at absent ngayong araw. | Admin, Management | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 17 | Open the monthly report and save it as CSV or PDF. / Buksan ang monthly report at i-save bilang CSV o PDF. | Admin, Management | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 18 | Check on Device Health whether the office screen (kiosk) is online. / Tingnan sa Device Health kung online ang screen ng opisina (kiosk). | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |
| 19 | Reset the phone of a BHW who got a new phone. / I-reset ang telepono ng BHW na may bagong telepono. | Admin | 1  2  3  4  5 | ☐ Yes / Oo  ☐ No / Hindi | |

### 3.3 Overall statements / Pangkalahatang pahayag

Circle one number for each statement. / Bilugan ang isang numero para sa bawat pahayag.

| # | Statement / Pahayag | Rating (circle one) |
| --- | --- | --- |
| S1 | The system is easy to use. / Madaling gamitin ang sistema. | 1  2  3  4  5 |
| S2 | Timing in and out is fast. / Mabilis ang pag-time in at pag-time out. | 1  2  3  4  5 |
| S3 | The messages on the screen are clear and tell me what to do. / Malinaw ang mga mensahe sa screen at sinasabi kung ano ang dapat gawin. | 1  2  3  4  5 |
| S4 | I trust that my recorded time is accurate. / Nagtitiwala ako na tama ang naitalang oras ko. | 1  2  3  4  5 |
| S5 | I feel my personal information is safe in this system. / Pakiramdam ko ay ligtas ang aking personal na impormasyon sa sistemang ito. | 1  2  3  4  5 |
| S6 | Filipino and English labels are easy to understand. / Madaling maintindihan ang mga salitang Filipino at Ingles. | 1  2  3  4  5 |
| S7 | The DTR and reports are correct and ready to submit. / Tama at handa nang isumite ang DTR at mga report. | 1  2  3  4  5 |
| S8 | The system saves time compared with the logbook. / Mas nakakatipid ng oras ang sistema kaysa sa logbook. | 1  2  3  4  5 |
| S9 | I would prefer this system over the logbook. / Mas gusto ko ang sistemang ito kaysa sa logbook. | 1  2  3  4  5 |
| S10 | I could learn the system with little training. / Matututunan ko ang sistema kahit kaunting pagsasanay lamang. | 1  2  3  4  5 |

### 3.4 Open questions / Bukas na tanong

1. What did you like most about the system? / Ano ang pinakanagustuhan mo sa sistema?
   ____________________________________________________________________________
2. Which task was the hardest, and why? / Aling gawain ang pinakamahirap, at bakit?
   ____________________________________________________________________________
3. Did you see any error, wrong time or confusing message? Please describe. / May nakita ka bang error, maling oras o nakalilitong mensahe? Pakilarawan.
   ____________________________________________________________________________
4. What should be changed or added before we use it every day? / Ano ang dapat baguhin o idagdag bago namin ito gamitin araw-araw?
   ____________________________________________________________________________

### 3.5 Sign-off / Paglagda

| Role | Name / Pangalan | Signature / Lagda | Date / Petsa |
| --- | --- | --- | --- |
| Tester / Tester | | | |
| UAT facilitator (System Analyst) / Tagapangasiwa ng UAT | | | |
| BHW Office in-charge / Namamahala sa BHW Office | | | |
| Proponent / Proponent: Janine Ariane Raganas, BSIT-2B | | | |

---

## 4. How to compute results

Collect all forms, then enter each answer in a spreadsheet: one row per tester, one column per task (1–19) and statement (S1–S10), plus one "completed without help" column per task. Leave a cell empty when the task was not for that tester's role.

| Measure | Formula | Example (task 4 rated 5, 4, 4, 5, 3 by five BHWs) |
| --- | --- | --- |
| Mean per item | Sum of ratings ÷ number of testers who rated the item | (5 + 4 + 4 + 5 + 3) ÷ 5 = **4.20** |
| % agree per item | Number of ratings of 4 or 5 ÷ number of ratings × 100 | 4 ÷ 5 × 100 = **80 %** |
| Completion rate per task | Number of "Yes" ÷ (Yes + No) × 100 | 5 Yes of 5 = **100 %** |
| Overall mean | Mean of all item means (tasks and S1–S10) | |

Interpretation of a mean (equal-width Likert bands):

| Mean | Interpretation / Kahulugan |
| --- | --- |
| 4.20 – 5.00 | Strongly agree / Lubos na sang-ayon |
| 3.40 – 4.19 | Agree / Sang-ayon |
| 2.60 – 3.39 | Neutral / Walang kinikilingan |
| 1.80 – 2.59 | Disagree / Hindi sang-ayon |
| 1.00 – 1.79 | Strongly disagree / Lubos na hindi sang-ayon |

**Acceptance threshold.** The system is accepted by users when **both** are true:

1. The overall mean is **≥ 4.0**, and
2. **No task** has a mean **below 3.5**.

Also report the mean separately for BHW, Admin and Management testers. A task with a mean below 3.5, or a completion rate below 80 %, is logged as a defect with the testers' comments, fixed, and re-tested with at least three testers from the same role before sign-off. Testers' comments that point to a wrong time, wrong total or lost scan are treated as defects regardless of the rating and are traced back to the matching test case in section 1.

Recommended sample: all 8 BHWs, the admin, and at least two Management users, using at least two different Android phones (one low-end) and the kiosk tablet in its final place at the BHW office.
