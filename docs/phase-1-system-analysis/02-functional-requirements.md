> **Role speaking: System Analyst**

# 02 – Functional Requirements

This document lists every functional requirement (FR) of the BHW QR Attendance System. Requirements are numbered continuously (FR-01, FR-02, ...) and grouped by module. Each requirement traces to at least one row of the **Study Recommendation** table in `development.md` (row names are written exactly as in that table) and, where relevant, to a binding decision (D-xx) in [`00-assumptions-and-decisions.md`](./00-assumptions-and-decisions.md).

All dates and times are Asia/Manila. "Server time" means the database/Edge Function clock, never the phone or kiosk clock.

**Actors:** Employee (BHW staff), Admin (administrator), Viewer (barangay management, read-only), Kiosk (QR station account), System (Supabase: database, Edge Functions, pg_cron, Realtime).

**Priority (MoSCoW):** **Must** = required for go-live and acceptance; **Should** = expected, may slip only with adviser approval; **Could** = desirable if time allows.

## Module index

| # | Module | FR range | Count |
| --- | --- | --- | --- |
| 1 | Registration | FR-01 – FR-10 | 10 |
| 2 | Employee Information Management | FR-11 – FR-20 | 10 |
| 3 | Approval | FR-21 – FR-26 | 6 |
| 4 | Device Binding | FR-27 – FR-34 | 8 |
| 5 | Kiosk QR | FR-35 – FR-43 | 9 |
| 6 | Scan Attendance | FR-44 – FR-61 | 18 |
| 7 | Fallback | FR-62 – FR-67 | 6 |
| 8 | Correction Requests | FR-68 – FR-77 | 10 |
| 9 | DTR | FR-78 – FR-85 | 8 |
| 10 | Reports | FR-86 – FR-94 | 9 |
| 11 | Dashboard | FR-95 – FR-101 | 7 |
| 12 | Schedules | FR-102 – FR-107 | 6 |
| 13 | Stations & Device Health | FR-108 – FR-113 | 6 |
| 14 | Device Sync | FR-114 – FR-119 | 6 |
| 15 | Error Logging | FR-120 – FR-125 | 6 |
| 16 | Audit | FR-126 – FR-131 | 6 |
| 17 | Settings | FR-132 – FR-136 | 5 |
| 18 | Authentication & Role-Based Access | FR-137 – FR-141 | 5 |
| 19 | Notifications | FR-142 – FR-145 | 4 |
| 20 | Scheduled Jobs | FR-146 – FR-151 | 6 |

---

## Registration

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-01 | The system shall provide a public web registration page (`/register`) that collects full name, BHW ID number, purok/area, contact number, optional home address, email, password and a profile photo. | Employee | Must | Employee information management, Identity verification; D-02 |
| FR-02 | The system shall validate registration input with the shared zod schema (required fields, email format, Philippine mobile number format `09XXXXXXXXX`, password of at least 8 characters, unique BHW ID number and email) and show field-level error messages in plain language without losing what the user typed. | Employee, System | Must | Employee information management |
| FR-03 | The system shall require an explicit, unticked-by-default Data Privacy consent checkbox linked to the `/privacy` notice, block submission until it is ticked, and store the consent timestamp in `profiles.consent_at`. | Employee, System | Must | Secure data handling + encryption, Employee information management |
| FR-04 | The system shall require the registrant to verify their email address through Supabase Auth before the registration appears in the admin's Pending Approvals list. | Employee, System | Must | Identity verification; D-04 |
| FR-05 | The system shall automatically create a `profiles` row with role `employee` and status `pending` when a registrant signs up, and shall never let a registrant choose their own role or status. | System | Must | Role-based access, Employee information management; D-01, D-02 |
| FR-06 | The system shall upload the profile photo (JPEG, PNG or WebP, at most 5 MB) to the private `profile-photos` storage bucket and store only its storage path in the profile. | Employee, System | Must | Employee information management, Secure data handling + encryption; D-31 |
| FR-07 | The system shall store the contact number and address encrypted at rest (`contact_number_enc`, `address_enc`) and shall never store them in plain text columns. | System | Must | Secure data handling + encryption; D-29 |
| FR-08 | The system shall route a signed-in user by status: `pending` to `/pending` (with "waiting for approval" guidance), `rejected` to `/rejected` (showing the rejection reason), `inactive` to a deactivated notice, and `active` users to their role's home page. | Employee, System | Must | Role-based access, Identity verification; D-01 |
| FR-09 | The system shall allow self-registration only for the `employee` role; admin, kiosk and viewer accounts shall be creatable only by an admin (or the seed script) and start as `active`. | Admin, System | Must | Role-based access; D-02 |
| FR-10 | The system shall provide a public Data Privacy notice page (`/privacy`) in English and Filipino stating the data collected, purpose, legal basis, retention periods, data-subject rights and the Data Protection Officer contact. | Employee, Viewer | Must | Secure data handling + encryption; D-32 |

## Employee Information Management

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-11 | The system shall provide an admin Employees page that lists all employee profiles in a paginated table with search (name, BHW ID number) and filters (status, purok/area, schedule). | Admin | Must | Employee information management |
| FR-12 | The system shall show an employee detail view with profile, BHW ID number, area, decrypted contact number and address (through `get_profile_private`), photo (signed URL), current and past schedules, status, bound device and a summary of the current month's attendance. | Admin | Must | Employee information management, Secure data handling + encryption; D-29, D-31 |
| FR-13 | The system shall allow the admin to edit an employee's full name, BHW ID number, area, contact number, address and photo, with the same validation as registration, and every change shall be recorded in the audit log. | Admin | Must | Employee information management, Audit trails |
| FR-14 | The system shall allow the admin to create admin, kiosk and viewer accounts, and to link each kiosk account to exactly one station. | Admin | Must | Employee information management, Role-based access; D-02, D-03 |
| FR-15 | The system shall allow the admin to deactivate an employee (status `inactive`) and to reactivate them; an inactive employee shall be unable to scan, bind a device or request a personal QR. | Admin | Must | Employee information management, Role-based access; D-01 |
| FR-16 | The system shall allow the admin to assign or change an employee's schedule from the employee detail view with an effective-from date (and optional effective-to date). | Admin | Must | Employee information management, Classification by approved schedule; D-19 |
| FR-17 | The system shall show the employee's bound device (platform, model, bound date) on the employee detail view and offer the "Reset device" action there. | Admin | Must | Employee information management, Identity verification; D-07 |
| FR-18 | The system shall let an employee view their own profile on the web (`/me`) and in the mobile Profile tab, and update their contact number, address and photo; changes to name, BHW ID number and area shall require the admin. | Employee | Should | Employee information management, Secure data handling + encryption |
| FR-19 | The system shall let an employee view all personal data the system holds about them (profile, bound devices, attendance records, correction requests, notifications) to support the right of access under RA 10173. | Employee | Should | Secure data handling + encryption, Employee information management |
| FR-20 | The system shall allow the admin, upon a verified erasure request from a former (inactive) employee, to erase the photo, contact number and address while keeping attendance records, correction requests and audit logs for their retention period; the action shall be audited. | Admin | Should | Secure data handling + encryption, Audit trails; D-32 |

## Approval

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-21 | The system shall provide a Pending Approvals page listing email-verified registrations with status `pending`, showing photo, full name, BHW ID number, area, email, consent date and registration date, oldest first. | Admin | Must | Employee information management, Identity verification; D-04 |
| FR-22 | The system shall let the admin approve a registration only after selecting a schedule and its effective-from date; approval shall set status `active`, `approved_by`, `approved_at` and create the `employee_schedules` row in one transaction. | Admin, System | Must | Employee information management, Classification by approved schedule; D-19 |
| FR-23 | The system shall let the admin reject a registration with a required reason; rejection shall set status `rejected` and store `rejection_reason`. | Admin, System | Must | Employee information management |
| FR-24 | The system shall notify the registrant of the approval or rejection (with the reason) through an in-app notification and, when email is configured, an email. | System | Must | Employee information management; D-33 |
| FR-25 | The system shall show the number of pending registrations as a badge in the admin sidebar and on the dashboard. | Admin | Should | Administrator dashboard |
| FR-26 | The system shall record every approval and rejection in the audit log with the acting admin and timestamp. | System | Must | Audit trails |

## Device Binding

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-27 | The mobile app shall generate a random installation UUID on first launch and keep it in SecureStore. | Employee, System | Must | Identity verification; D-05 |
| FR-28 | On the first successful mobile login the app shall call `bind-device`; if the account status is not `active` the app shall show the Blocked screen (pending, rejected or inactive, with the reason) and allow no other screen except logout. | Employee, System | Must | Identity verification, Role-based access; D-01, D-05 |
| FR-29 | The system shall store only `device_id_hash = HMAC-SHA256(DEVICE_HASH_PEPPER, raw_id)` and never the raw installation ID. | System | Must | Secure data handling + encryption, Identity verification; D-05 |
| FR-30 | The system shall allow at most one active (non-revoked) device per employee and shall not allow the same device hash to be active for two employees; a second phone shall be blocked with `DEVICE_MISMATCH` and the message to ask the admin for a reset. | System | Must | Identity verification, Presentation-attack detection; D-06 |
| FR-31 | The system shall record the platform, device model and `bound_at` time when a device is bound. | System | Should | Employee information management, Device health monitoring |
| FR-32 | The system shall let the admin reset an employee's device (set `revoked_at`), after which the next login from any phone binds that phone; every reset shall be audited. | Admin, System | Must | Identity verification, Audit trails; D-07 |
| FR-33 | The system shall keep and show the admin the device history of each employee (all bound and revoked devices with dates). | Admin | Should | Employee information management, Audit trails |
| FR-34 | The mobile app shall re-check the account status and device binding when it starts and when it returns to the foreground, and shall send the user to the Blocked or Bind Device screen if either is no longer valid. | Employee, System | Must | Identity verification, Device synchronization |

## Kiosk QR

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-35 | The system shall serve the kiosk page `/kiosk/[stationId]` only to a signed-in kiosk account linked to that station. | Kiosk, System | Must | Role-based access, Device + centralized database for time-in/time-out; D-03 |
| FR-36 | The kiosk shall request a new token from `issue-qr-token` every `token_refresh_seconds` (default 15 s) and display it as a full-screen QR code. | Kiosk | Must | Device + centralized database for time-in/time-out, Presentation-attack detection; D-09 |
| FR-37 | The system shall issue tokens with payload `{v, sid, n, iat, exp}` signed with HMAC-SHA256 using the server-only `QR_SIGNING_SECRET`, encoded with the `BHWQR1:` prefix. | System | Must | Presentation-attack detection, Identity verification; D-08 |
| FR-38 | The system shall give each token a lifetime of `token_lifetime_seconds` (default 30 s) and register its nonce in `qr_nonces` with station, issued and expiry times. | System | Must | Presentation-attack detection; D-09, D-10 |
| FR-39 | The kiosk shall show the station name, a countdown bar until the next refresh and a Manila clock computed from server time (not the tablet clock). | Kiosk | Must | Device synchronization, Device + centralized database for time-in/time-out |
| FR-40 | The kiosk shall show a live feed of recent successful scans at its own station through Realtime, displaying only first name, time-in/time-out label and time. | Kiosk, System | Should | Device + centralized database for time-in/time-out, Secure data handling + encryption; D-03 |
| FR-41 | The kiosk shall show an offline banner when it cannot reach the server and shall hide the QR (showing "Reconnecting...") once the last token has expired, so no expired QR stays on screen. | Kiosk | Must | Device health monitoring, Presentation-attack detection |
| FR-42 | The system shall support signing-secret rotation by accepting tokens signed with either `QR_SIGNING_SECRET` or `QR_SIGNING_SECRET_PREVIOUS` for 60 s after a rotation. | System | Should | Secure data handling + encryption, Presentation-attack detection; D-11 |
| FR-43 | The kiosk page shall use a dark full-screen layout, keep the screen awake (Wake Lock API where supported), and use only a subtle QR refresh fade that is disabled when `prefers-reduced-motion` is set. | Kiosk | Should | Device + centralized database for time-in/time-out |

## Scan Attendance

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-44 | The mobile app shall optionally require the phone's own fingerprint or Face ID (`expo-local-authentication`) to open the scan screen when the employee turns this on; no biometric data shall be sent or stored. | Employee | Could | Identity verification, Secure data handling + encryption; D-30 |
| FR-45 | The mobile app shall run a pre-scan health check (camera permission, location permission, GPS accuracy, internet connection, device still bound) and show a clear fix for each failed item using the mobile-only codes `CAMERA_DENIED`, `LOCATION_DENIED`, `LOCATION_UNAVAILABLE`, `OFFLINE`, `BIOMETRIC_FAILED`. | Employee, System | Must | Device health monitoring, Identity verification |
| FR-46 | The mobile app shall scan the kiosk QR with the camera, accept only content with the `BHWQR1:` prefix, and call `record-attendance` with the token, raw device ID, latitude, longitude, GPS accuracy and (when required) selfie. | Employee | Must | Device + centralized database for time-in/time-out, Identity verification; D-08 |
| FR-47 | `record-attendance` shall validate each request in the fixed order of the decisions file (JWT, rate limit of 10 requests per minute per user, request body, active employee, device, signature, expiry, nonce known, nonce not reused, station active, GPS accuracy, geofence, cooldown, day not completed, selfie) and stop at the first failure, returning its error code and HTTP status. | System | Must | Identity verification, Presentation-attack detection |
| FR-48 | The system shall reject a token whose `exp` is before the current server time, or whose `iat` is more than 5 s in the future, with `QR_EXPIRED`, so a screenshot older than 30 s is always rejected. | System | Must | Presentation-attack detection; D-09 |
| FR-49 | The system shall reject a nonce not found in `qr_nonces` for that station with `QR_UNKNOWN`, and a nonce already used by the same employee with `QR_REUSED` (recorded in `qr_nonce_uses`). | System | Must | Presentation-attack detection; D-10 |
| FR-50 | The system shall reject a scan whose GPS accuracy is worse than `max_gps_accuracy_m` (default 50 m) with `GPS_INACCURATE`, and a scan farther than the station's `radius_m` (default 100 m, Haversine distance) with `OUTSIDE_GEOFENCE` and a message that tells the employee to move closer to the office. | System | Must | Presentation-attack detection, Identity verification |
| FR-51 | The system shall reject a scan made within `cooldown_minutes` (default 5) of the employee's last successful scan with `COOLDOWN_ACTIVE`, showing the time when scanning is allowed again. | System | Must | Presentation-attack detection; D-20 |
| FR-52 | The system shall decide time-in or time-out from the employee's record for the work date, apply the overnight rule (scans before `overnight_cutoff_hour` close the previous day's open record), and reject a third scan on a completed day with `ALREADY_COMPLETED`. | System | Must | Classification by approved schedule, Device + centralized database for time-in/time-out; D-13, D-14 |
| FR-53 | The system shall compute `minutes_late` from the schedule start time and grace period, `undertime_minutes` from early departure, and the stored status using the precedence absent > incomplete > late > undertime > on_time. | System | Must | Classification by approved schedule; D-15, D-16, D-17 |
| FR-54 | The system shall accept scans on non-work days and holidays (status `on_time`, zero late/undertime, note "Non-working day" or the holiday name) and scans by active employees without a schedule (note "No schedule assigned"). | System | Must | Classification by approved schedule; D-18, D-19 |
| FR-55 | The system shall write every scan attempt, successful or failed, to `scan_attempts` with employee, station, success flag, error code, failure reason, latitude, longitude, accuracy, device hash, nonce and server timestamp. | System | Must | Error logging, Device + centralized database for time-in/time-out, Presentation-attack detection |
| FR-56 | The system shall return a friendly English or Filipino message with every result, and the app shall show an animated success or failure overlay (time-in/time-out, time, status) with haptic feedback. | Employee, System | Must | Device + centralized database for time-in/time-out |
| FR-57 | When `selfie_required` is on, the app shall capture a front-camera selfie with the scan and the system shall store it in the private `selfies` bucket, rejecting scans without one with `SELFIE_REQUIRED`. | Employee, System | Could | Presentation-attack detection; D-31 |
| FR-58 | The system shall flag anomalous scan activity for admin review: repeated failed attempts (5 or more failures by one employee within 10 minutes), repeated `OUTSIDE_GEOFENCE` or `QR_REUSED` failures, and locations reported as mocked by the phone. | System, Admin | Should | Presentation-attack detection, Device health monitoring |
| FR-59 | The mobile app shall never queue scans offline; when there is no connection it shall show an offline notice and ask the employee to reconnect and scan again. | Employee | Must | Presentation-attack detection, Device synchronization |
| FR-60 | The mobile app shall show a Home screen (greeting, Today card, This Week progress, recent records) and a History screen with week/month filters and a detail sheet for each day. | Employee | Must | Device + centralized database for time-in/time-out, Classification by approved schedule |
| FR-61 | The system shall allow inserts and updates to `attendance_records` only through Edge Functions, approved correction requests and admin RPCs; direct table writes by any client role shall be denied by RLS. | System | Must | Role-based access, Device + centralized database for time-in/time-out, Audit trails |

## Fallback

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-62 | The mobile app shall show a rotating personal QR on the My QR tab, issued by `issue-personal-qr` with the `BHWPQR1:` prefix, signed with `PERSONAL_QR_SIGNING_SECRET`, valid 30 s and refreshed every 15 s, only for an active employee on their bound device. | Employee, System | Must | Alternative authentication for verification failure, Presentation-attack detection; D-12 |
| FR-63 | The system shall provide an admin Fallback Scan page that scans an employee's personal QR with the computer or tablet camera and calls `record-fallback-scan`, which validates signature, expiry, nonce reuse and employee status, then records the time-in or time-out with method `fallback_personal_qr` using the same time-in/time-out and status rules as a kiosk scan. | Admin, System | Must | Alternative authentication for verification failure, Classification by approved schedule; D-12, D-14 |
| FR-64 | A fallback scan shall record the station chosen by the admin, the admin as `created_by`, and an optional note explaining why the kiosk scan failed. | Admin, System | Must | Alternative authentication for verification failure, Audit trails |
| FR-65 | The system shall let the admin enter attendance manually (employee, work date, time-in and/or time-out) through `manual_attendance_entry`, requiring a reason of at least 10 characters, and record it with method `manual`. | Admin, System | Must | Alternative authentication for verification failure, Audit trails |
| FR-66 | The system shall audit every fallback scan and manual entry including the reason, and show the method as a badge on the Attendance Records page, DTR source data and employee history. | System, Admin | Must | Alternative authentication for verification failure, Audit trails |
| FR-67 | The system shall reject manual entries for future dates or times, and recompute late, undertime and status from the schedule in effect on that work date. | System | Must | Alternative authentication for verification failure, Classification by approved schedule; D-15, D-16, D-17 |

## Correction Requests

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-68 | The system shall let an employee file a correction request from the mobile app (History "Request correction" action or Correction Request form) or the web `/me` page with type (`missing_time_in`, `missing_time_out`, `wrong_time`, `official_business`), work date, requested time-in and/or time-out, reason and optional attachment. | Employee | Must | Correction requests with approval workflow; D-25 |
| FR-69 | The system shall enforce eligibility: work date not in the future; within the current month, or in the previous month while today is within the first `correction_window_days` (default 5) days of the month; and at most one pending request per employee per work date. | System | Must | Correction requests with approval workflow; D-26 |
| FR-70 | The system shall accept one optional attachment (image or PDF, at most 5 MB) stored in the private `correction-attachments` bucket and shown only through signed URLs. | Employee, System | Should | Correction requests with approval workflow, Secure data handling + encryption; D-26, D-31 |
| FR-71 | The system shall show the employee a My Requests list with each request's status (`pending`, `approved`, `rejected`, `cancelled`), dates and the admin's remarks. | Employee | Must | Correction requests with approval workflow |
| FR-72 | The system shall let an employee cancel their own pending request, setting its status to `cancelled`; approved, rejected or cancelled requests cannot be changed by the employee. | Employee | Must | Correction requests with approval workflow, Role-based access; D-27 |
| FR-73 | The system shall provide an admin Correction Requests page listing requests with filters (status, type, employee, date) and showing the current attendance record next to the requested values and the attachment. | Admin | Must | Correction requests with approval workflow |
| FR-74 | The system shall let the admin approve or reject a request with remarks (required on rejection); approval shall, in one transaction, create or update the attendance record with method `correction`, recompute status, set the request to `approved` with `reviewed_by` and `reviewed_at`, and create a notification, so the record and DTR update automatically. | Admin, System | Must | Correction requests with approval workflow, Automatic Daily Time Records (DTRs), Classification by approved schedule; D-27, D-28 |
| FR-75 | When an approved `official_business` request has both times blank, the system shall set time-in and time-out to the schedule's start and end times with the note "Official business". | System | Must | Correction requests with approval workflow, Classification by approved schedule; D-28 |
| FR-76 | The system shall notify the employee in-app and, when email is configured, by email when their request is approved or rejected, including the admin's remarks. | System | Must | Correction requests with approval workflow; D-33 |
| FR-77 | The system shall audit every creation, cancellation, approval and rejection of a correction request and every attendance change it causes. | System | Must | Correction requests with approval workflow, Audit trails |

## DTR

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-78 | The system shall generate a monthly Daily Time Record per employee in the Civil Service Form No. 48 layout through `get_dtr(employee_id, year, month)`, with one row for each calendar day 1–31. | Admin, Employee, System | Must | Automatic Daily Time Records (DTRs) |
| FR-79 | The DTR shall place time-in under AM Arrival when it is before the schedule's `break_start` (otherwise PM Arrival) and time-out under PM Departure when it is after `break_end` (otherwise AM Departure); unscanned lunch cells stay blank unless `dtr_fill_break_times` is on; weekends and holidays without scans show the day label or holiday name. | System | Must | Automatic Daily Time Records (DTRs); D-22 |
| FR-80 | The DTR Undertime column (hours and minutes) shall equal `minutes_late + undertime_minutes` per day, show the full scheduled minutes and the word "Absent" for absent work days, show "No time-out" for incomplete days, and show monthly totals equal to the sum of the daily values. | System | Must | Automatic Daily Time Records (DTRs), Classification by approved schedule; D-23 |
| FR-81 | The DTR shall include the employee name, month and year, "Regular days" and "Saturdays" office-hour lines filled from the schedule, the CSC certification text, the employee signature line and the "Verified as to the prescribed office hours" in-charge signature line. | System | Must | Automatic Daily Time Records (DTRs); D-24 |
| FR-82 | The system shall let the admin and the employee print the DTR (A4 or legal paper) and download it as PDF through `generate-dtr-pdf`. | Admin, Employee | Must | Automatic Daily Time Records (DTRs) |
| FR-83 | The system shall let the admin batch-generate DTRs for all active employees for a selected month (`get_dtr_batch`) as one printable PDF with one employee per page. | Admin | Must | Automatic Daily Time Records (DTRs) |
| FR-84 | The system shall let an employee view and download only their own DTR in the mobile My DTR screen and on `/me`. | Employee | Must | Automatic Daily Time Records (DTRs), Role-based access |
| FR-85 | The system shall build the DTR from the current attendance records each time it is requested (no stored copy), so approved corrections, manual entries and fallback scans appear immediately. | System | Must | Automatic Daily Time Records (DTRs), Correction requests with approval workflow |

## Reports

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-86 | The system shall produce a daily report for a selected date listing each employee's time-in, time-out, status, minutes late, undertime minutes and method, with totals per status (`get_daily_summary`). | Admin, Viewer | Must | Attendance reports, Classification by approved schedule |
| FR-87 | The system shall produce a weekly report (Monday–Sunday, Manila) with per-employee and per-day counts of on time, late, undertime, absent and incomplete, and total late and undertime minutes (`get_weekly_summary`). | Admin, Viewer | Must | Attendance reports |
| FR-88 | The system shall produce a monthly report per employee with days present, late, undertime, absent and incomplete, and total late and undertime minutes (`get_monthly_summary`). | Admin, Viewer | Must | Attendance reports |
| FR-89 | The system shall let users filter reports by date range, employee, purok/area and status. | Admin, Viewer | Should | Attendance reports |
| FR-90 | The system shall export any report to CSV (UTF-8, Manila times in `YYYY-MM-DD HH:mm` format). | Admin, Viewer | Must | Attendance reports |
| FR-91 | The system shall produce printable and PDF versions of every report with a barangay header (`office_name`, `office_address`), report period, and "generated by" name and Manila timestamp. | Admin, Viewer | Must | Attendance reports |
| FR-92 | The system shall compute report totals directly from `attendance_records` with the same rules used for status, so daily, weekly and monthly totals match the raw records exactly. | System | Must | Attendance reports, Classification by approved schedule |
| FR-93 | The system shall give viewers read-only access to reports and the dashboard, with no create, edit, approve or export of personal contact data. | Viewer | Must | Attendance reports, Role-based access |
| FR-94 | The system shall provide an admin Attendance Records page to browse and search raw records (employee, date range, status, method, station) with links to the related scan attempts, corrections and audit entries. | Admin | Must | Attendance reports, Device + centralized database for time-in/time-out |

## Dashboard

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-95 | The system shall show admin dashboard stat cards for today (Manila) with Present, Late, Undertime, Absent and Total employee counts from `get_dashboard_today`. Before the 04:05 end-of-day job, today's `absent` rows do not exist yet, so the Absent card shows the "No record yet" count (`no_record_yet_count`) instead (BR-86). | Admin | Must | Administrator dashboard, Classification by approved schedule |
| FR-96 | The system shall show a weekly stacked bar chart of on time, late, undertime, absent and incomplete counts per day. | Admin, Viewer | Must | Administrator dashboard, Attendance reports |
| FR-97 | The system shall show a live scans list and refresh the stat cards through Realtime within 2 seconds of a successful scan, without a page reload. | Admin, System | Must | Administrator dashboard, Device + centralized database for time-in/time-out |
| FR-98 | The system shall show today's attendance table (employee, time-in, time-out, status, method). | Admin | Must | Administrator dashboard |
| FR-99 | The system shall show counts of pending registrations and pending correction requests with links to their pages. | Admin | Must | Administrator dashboard, Correction requests with approval workflow |
| FR-100 | The system shall show device alerts on the dashboard: offline kiosks, kiosks with clock drift above 30 s, and critical errors from the last 24 hours. | Admin | Must | Administrator dashboard, Device health monitoring, Error logging; D-34 |
| FR-101 | The system shall show viewers a read-only dashboard with the stat cards and charts but without action buttons, live personal details or contact data. | Viewer | Must | Administrator dashboard, Role-based access |

## Schedules

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-102 | The system shall let the admin create, view, edit and delete schedules with name, work days, start time, end time, grace minutes, break start and break end. | Admin | Must | Classification by approved schedule; D-19 |
| FR-103 | The system shall validate schedules: at least one work day, end time after start time, break inside working hours, grace minutes from 0 to 60. | System | Must | Classification by approved schedule |
| FR-104 | The system shall assign schedules to employees with effective-from and optional effective-to dates, not allow overlapping assignments for the same employee, and use the schedule in effect on each work date. | Admin, System | Must | Classification by approved schedule; D-19 |
| FR-105 | The system shall never recompute past records when a schedule changes, except through an admin "recompute" action for a chosen employee and date range, which is audited. | Admin, System | Must | Classification by approved schedule, Audit trails; D-19 |
| FR-106 | The system shall let the admin manage holidays (date and name) used by status computation, the end-of-day job, reports and the DTR. | Admin | Must | Classification by approved schedule, Automatic Daily Time Records (DTRs); D-18 |
| FR-107 | The system shall prevent deleting a schedule that is or was assigned to any employee, and explain why. | System | Should | Classification by approved schedule, Audit trails |

## Stations & Device Health

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-108 | The system shall let the admin create, edit and deactivate stations with name, latitude, longitude, geofence radius, active flag and linked kiosk account. | Admin | Must | Device + centralized database for time-in/time-out, Presentation-attack detection; D-03 |
| FR-109 | The kiosk shall send a heartbeat to `kiosk-heartbeat` every `heartbeat_interval_seconds` (default 60 s) with app version, clock drift and last token time; the system shall store it in `kiosk_heartbeats` and update `stations.last_seen_at` and `is_online`. | Kiosk, System | Must | Device health monitoring, Device synchronization; D-34 |
| FR-110 | The system shall mark a station offline when no heartbeat arrives for 3 intervals, write a critical `error_logs` entry, and push the change to the dashboard through Realtime so it shows within 3 minutes of the first missed heartbeat. | System | Must | Device health monitoring, Error logging; D-34 |
| FR-111 | The system shall provide a Device Health page showing each station's online status, last seen time, app version, last token issued and clock drift (warning above 30 s). | Admin | Must | Device health monitoring |
| FR-112 | The system shall show each station's heartbeat history for the last 30 days. | Admin | Should | Device health monitoring; D-32 |
| FR-113 | The Device Health page shall summarise failed scan attempts of the last 24 hours by error code and station, and list the anomaly flags raised for review. | Admin | Should | Device health monitoring, Presentation-attack detection |

## Device Sync

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-114 | The system shall use server time for every attendance timestamp, token time and status computation, and never trust a phone or kiosk clock. | System | Must | Device synchronization, Presentation-attack detection |
| FR-115 | The mobile app shall cache the employee's history, DTR and requests for offline viewing and re-fetch them automatically when the connection returns. | Employee | Should | Device synchronization |
| FR-116 | The system shall provide a documented `device-sync` Edge Function contract (authentication, request and response schema, error codes, idempotency) that lets a future fingerprint terminal submit attendance events into the existing tables without schema changes. | System | Must | Device synchronization, Device + centralized database for time-in/time-out |
| FR-117 | The `device-sync` endpoint shall process each event at most once using a client-supplied event ID and validate requests against the documented contract. | System | Should | Device synchronization |
| FR-118 | The kiosk shall, after a reconnect, immediately request a new token and send a heartbeat instead of waiting for the next interval. | Kiosk | Should | Device synchronization, Device health monitoring |
| FR-119 | The system shall measure and store kiosk clock drift (kiosk time minus server time) on every heartbeat. | System | Must | Device synchronization, Device health monitoring; D-34 |

## Error Logging

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-120 | The system shall provide a `log-error` Edge Function that accepts errors from the kiosk, mobile app and web with source, severity (`info`, `warning`, `error`, `critical`), message and context, rate limited per user, and stores them in `error_logs`. | Kiosk, Employee, Admin, System | Must | Error logging |
| FR-121 | Every Edge Function shall log its own unexpected failures (`INTERNAL_ERROR`) to `error_logs` with source `edge_function` and the function name. | System | Must | Error logging |
| FR-122 | The system shall remove secrets, tokens, raw device IDs, passwords and decrypted personal fields from error context before storing it. | System | Must | Error logging, Secure data handling + encryption |
| FR-123 | The system shall provide an admin Error Logs page with filters (source, severity, date range) and a detail view of the context. | Admin | Must | Error logging |
| FR-124 | The system shall show failed scans from `scan_attempts` to the admin with error code, employee, station and time. | Admin | Must | Error logging, Presentation-attack detection |
| FR-125 | The mobile app shall keep unsent error reports locally while offline and send them when the connection returns (errors only, never scans). | Employee, System | Should | Error logging, Device synchronization |

## Audit

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-126 | The system shall record, through database triggers, every insert, update and delete on `attendance_records`, `profiles`, `devices`, `correction_requests` and `schedules` (and also `employee_schedules`, `stations`, `holidays` and `app_settings`) with actor, action, table, record ID, old data, new data and server timestamp, except updates that change only `stations.last_seen_at` and `stations.is_online` (heartbeat and offline-detection writes), which are excluded to avoid about 1,440 rows per station per day; offline transitions are recorded in `error_logs` instead (D-34). | System | Must | Audit trails |
| FR-127 | The system shall keep audit logs append-only: no role, including admin, can update or delete them through the API. | System | Must | Audit trails, Role-based access |
| FR-128 | The system shall provide an admin Audit Log page with filters (actor, table, action, date range) and a side-by-side view of old and new values. | Admin | Must | Audit trails |
| FR-129 | The system shall include the reason in the audit entry of every manual entry, fallback scan note, device reset and correction review. | System | Must | Audit trails, Alternative authentication for verification failure |
| FR-130 | The system shall store encrypted fields in audit entries only as a "[changed]" marker, never as plain text. | System | Must | Audit trails, Secure data handling + encryption; D-29 |
| FR-131 | The system shall let the admin export filtered audit logs to CSV and shall deny viewers, employees and kiosks any access to audit logs. | Admin | Should | Audit trails, Role-based access |

## Settings

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-132 | The system shall let the admin view and edit every `app_settings` key (geofence radius, GPS accuracy, cooldown, token lifetime and refresh, selfie required and retention, overnight cutoff, correction window, heartbeat interval, DTR break fill, office name and address) with range validation, and every change shall be audited. | Admin | Must | Presentation-attack detection, Classification by approved schedule, Audit trails |
| FR-133 | The system shall apply changed settings on the next request without redeploying any app or function. | System | Must | Device synchronization |
| FR-134 | The system shall use `office_name` and `office_address` in report headers, DTR headers and the kiosk page. | System | Should | Attendance reports, Automatic Daily Time Records (DTRs) |
| FR-135 | The mobile app shall provide a Profile & Settings screen with dark mode, biometric unlock toggle, English/Filipino language, privacy notice and logout. | Employee | Must | Identity verification, Secure data handling + encryption |
| FR-136 | The web portal shall provide a light/dark theme toggle that is remembered per browser. | Admin, Viewer, Employee | Could | Administrator dashboard |

## Authentication & Role-Based Access

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-137 | The system shall authenticate all users with Supabase Auth email and password on web and mobile, and support password reset by email. | Employee, Admin, Viewer, Kiosk | Must | Identity verification, Role-based access |
| FR-138 | The system shall enforce the roles `admin`, `employee`, `kiosk` and `viewer` with Row Level Security on every table, Next.js middleware on every protected route, and an `is_admin()` check inside every admin RPC. | System | Must | Role-based access; D-01 |
| FR-139 | The system shall limit data by role: employees see only their own rows, viewers read only reports and dashboards, kiosks only issue tokens, send heartbeats, log errors and read their own station feed, and admins have full access. | System | Must | Role-based access, Secure data handling + encryption; D-03 |
| FR-140 | The mobile app shall keep the session in SecureStore and clear it on logout without removing the device binding. | Employee | Must | Secure data handling + encryption, Identity verification |
| FR-141 | The system shall check the caller's role and status on the server for every Edge Function and RPC call, not only in the user interface. | System | Must | Role-based access, Identity verification |

## Notifications

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-142 | The system shall store in-app notifications in `notifications` and show them on web `/me` and in the mobile app with an unread count and a "mark as read" action. | Employee, System | Must | Correction requests with approval workflow, Employee information management; D-33 |
| FR-143 | The system shall send approval, rejection and correction outcome emails through `send-notification-email` when `RESEND_API_KEY` is set, and fall back to in-app only otherwise. | System | Should | Correction requests with approval workflow, Employee information management; D-33 |
| FR-144 | The system shall create notifications for registration approved or rejected, correction approved or rejected, and device reset (to the employee), and for new registrations, new correction requests, kiosk offline transitions (FR-110, kind `kiosk_offline`) and the weekly periodic verification report (FR-149, kind `periodic_verification`) (to admins). | System | Must | Correction requests with approval workflow, Employee information management, Administrator dashboard |
| FR-145 | The system shall notify an employee in-app when the end-of-day job marks their record `incomplete`, suggesting a `missing_time_out` correction request. | System | Should | Correction requests with approval workflow, Classification by approved schedule |

## Scheduled Jobs

| ID | Requirement | Actor(s) | Priority | Traces to |
| --- | --- | --- | --- | --- |
| FR-146 | The system shall run the end-of-day job daily at 04:05 Manila for the previous work date: insert `absent` records for active employees with a scheduled work day and no record (skipping holidays and non-work days) and set `incomplete` on records with time-in and no time-out. | System | Must | Classification by approved schedule, Automatic Daily Time Records (DTRs); D-18, D-21 |
| FR-147 | The system shall delete `qr_nonces` and `qr_nonce_uses` older than 1 day every hour. | System | Must | Presentation-attack detection, Secure data handling + encryption; D-32 |
| FR-148 | The system shall run kiosk offline detection every minute. | System | Must | Device health monitoring; D-34 |
| FR-149 | The system shall produce a weekly periodic verification report for the admin listing active employees without a bound device, active employees without a schedule, anomalous scan flags and stale accounts (pending over 30 days or no scan in 60 days). | System, Admin | Should | Identity verification, Presentation-attack detection, Classification by approved schedule |
| FR-150 | The system shall delete data past its retention period daily: selfies after `selfie_retention_days`, `kiosk_heartbeats` after 30 days, `error_logs` after 180 days, `scan_attempts` and `notifications` after 1 year, rejected registrations 90 days after rejection (counted from `profiles.approved_at`), and attendance records, correction requests and audit logs after 5 years. | System | Must | Secure data handling + encryption; D-32 |
| FR-151 | Every scheduled job shall record its outcome, and a failed run shall write an `error_logs` entry with severity `error`. | System | Should | Error logging |

---

## Traceability Matrix

### A. Study Recommendation → Functional Requirements

| # | Study Recommendation row | FR IDs | Count |
| --- | --- | --- | --- |
| 1 | Device + centralized database for time-in/time-out | FR-35, FR-36, FR-39, FR-40, FR-43, FR-46, FR-52, FR-55, FR-56, FR-60, FR-61, FR-94, FR-97, FR-108, FR-116 | 15 |
| 2 | Identity verification | FR-01, FR-04, FR-08, FR-17, FR-21, FR-27, FR-28, FR-29, FR-30, FR-32, FR-34, FR-37, FR-44, FR-45, FR-46, FR-47, FR-50, FR-135, FR-137, FR-140, FR-141, FR-149 | 22 |
| 3 | Automatic Daily Time Records (DTRs) | FR-74, FR-78, FR-79, FR-80, FR-81, FR-82, FR-83, FR-84, FR-85, FR-106, FR-134, FR-146 | 12 |
| 4 | Attendance reports | FR-86, FR-87, FR-88, FR-89, FR-90, FR-91, FR-92, FR-93, FR-94, FR-96, FR-134 | 11 |
| 5 | Classification by approved schedule | FR-16, FR-22, FR-52, FR-53, FR-54, FR-60, FR-63, FR-67, FR-74, FR-75, FR-80, FR-86, FR-92, FR-95, FR-102, FR-103, FR-104, FR-105, FR-106, FR-107, FR-132, FR-145, FR-146, FR-149 | 24 |
| 6 | Alternative authentication for verification failure | FR-62, FR-63, FR-64, FR-65, FR-66, FR-67, FR-129 | 7 |
| 7 | Device health monitoring | FR-31, FR-41, FR-45, FR-58, FR-100, FR-109, FR-110, FR-111, FR-112, FR-113, FR-118, FR-119, FR-148 | 13 |
| 8 | Presentation-attack detection | FR-30, FR-36, FR-37, FR-38, FR-41, FR-42, FR-47, FR-48, FR-49, FR-50, FR-51, FR-55, FR-57, FR-58, FR-59, FR-62, FR-108, FR-113, FR-114, FR-124, FR-132, FR-147, FR-149 | 23 |
| 9 | Employee information management | FR-01, FR-02, FR-03, FR-05, FR-06, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-21, FR-22, FR-23, FR-24, FR-31, FR-33, FR-142, FR-143, FR-144 | 23 |
| 10 | Correction requests with approval workflow | FR-68, FR-69, FR-70, FR-71, FR-72, FR-73, FR-74, FR-75, FR-76, FR-77, FR-85, FR-99, FR-142, FR-143, FR-144, FR-145 | 16 |
| 11 | Device synchronization | FR-34, FR-39, FR-59, FR-109, FR-114, FR-115, FR-116, FR-117, FR-118, FR-119, FR-125, FR-133 | 12 |
| 12 | Error logging | FR-55, FR-100, FR-110, FR-120, FR-121, FR-122, FR-123, FR-124, FR-125, FR-151 | 10 |
| 13 | Administrator dashboard | FR-25, FR-95, FR-96, FR-97, FR-98, FR-99, FR-100, FR-101, FR-136, FR-144 | 10 |
| 14 | Role-based access | FR-05, FR-08, FR-09, FR-14, FR-15, FR-28, FR-35, FR-61, FR-72, FR-84, FR-93, FR-101, FR-127, FR-131, FR-137, FR-138, FR-139, FR-141 | 18 |
| 15 | Secure data handling + encryption | FR-03, FR-06, FR-07, FR-10, FR-12, FR-18, FR-19, FR-20, FR-29, FR-40, FR-42, FR-44, FR-70, FR-122, FR-130, FR-135, FR-139, FR-140, FR-147, FR-150 | 20 |
| 16 | Audit trails | FR-13, FR-20, FR-26, FR-32, FR-33, FR-61, FR-64, FR-65, FR-66, FR-77, FR-105, FR-107, FR-126, FR-127, FR-128, FR-129, FR-130, FR-131, FR-132 | 19 |

### B. Acceptance Criteria → Functional Requirements

| # | Acceptance criterion (from `development.md`) | FR IDs |
| --- | --- | --- |
| AC-01 | A pending user cannot use the mobile app. | FR-08, FR-28, FR-34, FR-47, FR-141 |
| AC-02 | A kiosk QR screenshot older than 30 seconds is rejected. | FR-37, FR-38, FR-48, FR-114 |
| AC-03 | The same QR cannot be used twice by the same user. | FR-38, FR-47, FR-49 |
| AC-04 | Scans outside the geofence are rejected with a clear message. | FR-50, FR-56, FR-108 |
| AC-05 | The admin dashboard updates within 2 seconds of a successful scan. | FR-55, FR-95, FR-97 |
| AC-06 | Daily/weekly/monthly reports match the raw records exactly. | FR-86, FR-87, FR-88, FR-92 |
| AC-07 | Every manual correction appears in the audit log with a reason. | FR-65, FR-66, FR-77, FR-126, FR-129 |
| AC-08 | An approved correction request updates the attendance record and the DTR automatically. | FR-74, FR-75, FR-85 |
| AC-09 | The generated DTR follows the CSC Form 48 layout and its totals (including undertime) match the records. | FR-78, FR-79, FR-80, FR-81, FR-82 |
| AC-10 | A kiosk that stops sending heartbeats is shown as offline on the dashboard within 3 minutes. | FR-100, FR-109, FR-110, FR-148 |
| AC-11 | Errors from Edge Functions, kiosk and mobile app appear in Error Logs. | FR-120, FR-121, FR-123, FR-125 |
| AC-12 | Sensitive profile fields are encrypted at rest and no biometric data is stored. | FR-07, FR-29, FR-44, FR-130 |

> **Backend Developer note:** FR-61 (insert-only through Edge Functions/RPCs), FR-127 (append-only audit) and FR-130 (redacted encrypted fields in audit) drive RLS policies and trigger design in Phase 3.
>
> **Frontend Designer / Developer note:** FR-56 (scan result overlay), FR-45 (pre-scan health check) and FR-97 (2-second live dashboard) define the main interaction states that the Phase 4 and Phase 5 screens must cover.
