> **Role speaking: System Analyst**

# 01 – Scope Statement

**Project:** BHW QR Attendance System
**Client:** Barangay Kalawag II Health Workers (BHW) Office, Philippines
**Proponent:** Janine Ariane Raganas, BSIT-2B
**Timezone for all attendance logic, reports and displayed times:** Asia/Manila (UTC+08:00, no daylight saving time)
**Binding decisions:** [`00-assumptions-and-decisions.md`](./00-assumptions-and-decisions.md) (D-01 to D-34)

---

## 1. Purpose

The BHW Office records attendance by hand in a logbook. Entries are slow to check, can be incomplete or inconsistent, and the daily, weekly and monthly reports, including the Civil Service Form No. 48 Daily Time Record (DTR), take hours of manual work every month.

The BHW QR Attendance System replaces the logbook with:

- a **website** where BHWs register and administrators manage employees, schedules, corrections, DTRs and reports;
- a **kiosk screen** at the office that shows a rotating, cryptographically signed QR code;
- a **mobile app** bound to each BHW's phone that scans the kiosk QR to time in and time out;
- a **Supabase backend** that validates every scan, classifies attendance against the approved schedule, and keeps a full audit trail.

The system delivers every feature of the study's recommendation for a biometric attendance system, using QR scanning on an authenticated, device-bound phone as the identity-verification device instead of a fingerprint scanner. It must be accurate, secure, private (RA 10173 compliant), easy to use on low-end Android phones, and reliable enough for real daily use at the barangay.

---

## 2. In scope

### 2.1 Modules

| # | Module | What is included in this release |
| --- | --- | --- |
| 1 | Registration | Web self-registration for BHWs (full name, BHW ID number, purok/area, contact number, optional address, email, password, profile photo), required Data Privacy consent, email verification (D-04), `pending` status, `/pending`, `/rejected` and `/privacy` pages. |
| 2 | Employee Information Management | Admin list, search, view, edit, deactivate and reactivate employees; creation of admin, kiosk and viewer accounts (D-02); employee self-service profile at `/me` and in the mobile Profile tab; data-subject access and correction. |
| 3 | Approval | Pending Approvals page; approve with schedule assignment or reject with a reason; email and in-app notification (D-33). |
| 4 | Device Binding | One active phone per employee, hashed installation ID (D-05, D-06), Bind Device screen, Blocked screen for pending/rejected/inactive accounts, admin device reset (D-07). |
| 5 | Kiosk QR | `/kiosk/[stationId]` full-screen dark page, signed rotating QR (D-08, D-09), countdown bar, Manila clock from server time, Realtime recent-scan feed, offline banner. |
| 6 | Scan Attendance | Optional phone biometric unlock, pre-scan health check, `record-attendance` validation in the fixed order of section D of the decisions file, time-in/time-out decision (D-13, D-14), status computation (D-15 to D-19), cooldown (D-20), scan result overlay, attendance history. |
| 7 | Fallback | Rotating personal QR in the app scanned by the admin (D-12, method `fallback_personal_qr`) and admin manual entry with a required reason (method `manual`). |
| 8 | Correction Requests | Filing (D-25), eligibility window (D-26), attachments, cancellation (D-27), admin approve/reject with remarks, automatic update of the attendance record and DTR (D-28). |
| 9 | DTR | CSC Form No. 48 monthly DTR per employee (D-22 to D-24), print and PDF, batch generation for all employees, employee self-service DTR. |
| 10 | Reports | Daily, weekly and monthly summaries with filters, CSV and PDF export, barangay header; Attendance Records page. |
| 11 | Dashboard | Live admin dashboard (stat cards, weekly stacked bar chart, live scans, today's table, pending items, device alerts) and read-only viewer dashboard. |
| 12 | Schedules | Schedule CRUD with grace period and break times (D-19), effective-dated assignment, holidays, audited recompute. |
| 13 | Stations & Device Health | Station CRUD with coordinates and geofence radius, kiosk heartbeat, offline detection within 3 minutes (D-34), Device Health page. |
| 14 | Device Sync | Server time everywhere, mobile cache and re-sync on reconnect, documented `device-sync` contract for a future fingerprint terminal. |
| 15 | Error Logging | `log-error` Edge Function, `error_logs` table, Error Logs page, failed scans in `scan_attempts`. |
| 16 | Audit | Audit triggers on attendance, profiles, devices, corrections and schedules (plus related tables), append-only Audit Log page. |
| 17 | Settings | `app_settings` editor (section M of the decisions file), mobile Profile & Settings (dark mode, biometric unlock, English/Filipino, privacy notice, logout), web theme toggle. |
| 18 | Authentication & Role-Based Access | Supabase Auth email + password, password reset, roles `admin`, `employee`, `kiosk`, `viewer` (D-01) enforced by Row Level Security and route middleware. |
| 19 | Notifications | In-app `notifications` table and optional email through `send-notification-email` (D-33). |
| 20 | Scheduled Jobs | pg_cron end-of-day absence and incomplete marking (D-21), nonce cleanup, kiosk offline detection, weekly periodic verification report, retention cleanup (D-32). |

### 2.2 Study Recommendation coverage

Every row of the Study Recommendation table in `development.md` is in scope:

- **Device + centralized database for time-in/time-out** – kiosk QR station plus mobile app; every record stored in Supabase Postgres.
- **Identity verification** – authenticated account, device binding, signed rotating QR, geofence, optional phone fingerprint/Face ID unlock.
- **Automatic Daily Time Records (DTRs)** – CSC Form No. 48 monthly DTR per employee, printable, PDF export, batch generation.
- **Attendance reports** – daily, weekly and monthly summaries with CSV/PDF export.
- **Classification by approved schedule** – on time, late, undertime, absent and incomplete, computed from the approved schedule and grace period.
- **Alternative authentication for verification failure** – personal rotating QR scanned by the admin, or admin manual entry with a reason.
- **Device health monitoring** – kiosk heartbeat every 60 s, mobile pre-scan health check, Device Health page, offline alerts.
- **Presentation-attack detection** – 30 s QR expiry, single-use nonce per employee (D-10), screenshot/replay rejection, device binding, geofence, scan cooldown, optional selfie, anomaly flags.
- **Employee information management** – full employee CRUD: profile, BHW ID, area, contact, photo, schedule, status, device.
- **Correction requests with approval workflow** – file, review, approve or reject with remarks, automatic record and DTR update, audit.
- **Device synchronization** – server time only, kiosk heartbeat, mobile cache and re-sync, documented `device-sync` API.
- **Error logging** – `error_logs` for Edge Function, kiosk, mobile and web errors; Error Logs page; failed scans in `scan_attempts`.
- **Administrator dashboard** – live counts, trends, live scans, pending approvals and corrections, device alerts.
- **Role-based access** – admin, employee, kiosk, viewer, enforced by RLS and route middleware.
- **Secure data handling + encryption** – TLS, hashed device IDs, pgcrypto/Vault encryption of contact number and address (D-29), private storage with signed URLs (D-31), secrets only in Edge Function environment, no biometric data stored (D-30).
- **Audit trails** – triggers on every change to attendance, profiles, devices, corrections and schedules.

### 2.3 Deliverables

- Phase 1 analysis documents (this folder): scope, functional and non-functional requirements, use cases, business rules, flowcharts, context diagram and DFD, ERD, data dictionary, risk list.
- Monorepo (`apps/web`, `apps/mobile`, `packages/types`, `packages/design-tokens`, `supabase`) with migrations, RLS, SQL functions, Edge Functions, pg_cron jobs and seed data.
- Next.js admin portal, registration pages and kiosk page; Expo Android app (APK/AAB through EAS Build).
- Automated tests (pgTAP, Deno, Jest + React Native Testing Library, Playwright), test case table, UAT form.
- Admin manual, one-page BHW staff quick guide (English with Filipino terms), kiosk setup guide, README.

---

## 3. Out of scope (this release)

| # | Item | Reason / what exists instead |
| --- | --- | --- |
| 1 | Payroll computation, salary deductions and honorarium processing | The system produces DTRs and reports that the municipal/barangay payroll process can use; computing pay is a separate process. |
| 2 | Leave management (leave filing, leave credits, approval of leave) | Not in the study recommendation. Absences can be explained through correction requests of type `official_business` or admin manual entry. |
| 3 | Fingerprint scanner hardware integration | Replaced by QR. Only the `device-sync` API contract is delivered so a terminal can be added later without schema changes. |
| 4 | Storage of any biometric data (fingerprint templates, face templates) | Prohibited by D-30. The phone's own fingerprint/Face ID only unlocks the scan screen locally. |
| 5 | Offline scan queueing on the mobile app | Scans need server time, a fresh nonce and live validation; a queued scan could be replayed or back-dated. The app shows an offline notice and asks the user to reconnect. |
| 6 | SMS notifications | In-app notifications and optional email only (D-33). |
| 7 | iOS App Store publishing | Optional. The Expo app is built to run on iOS, but the release target is Android (APK/AAB). |
| 8 | Push notifications (FCM/APNs) | In-app notification list only in this release. |
| 9 | Multiple barangays / multi-tenant operation | One BHW office; stations and settings are for that office. |
| 10 | Integration with external HR or government systems (e.g., CSC, LGU HRIS) | DTRs are exported as PDF/print and reports as CSV/PDF. |
| 11 | Lunch-break (four-scan) attendance | One time-in and one time-out per day (D-14); DTR lunch cells follow D-22. |
| 12 | Face recognition on selfies | Optional selfies are stored only as evidence for admin review and deleted after `selfie_retention_days` (D-32); no automated matching. |

---

## 4. Assumptions

| # | Assumption | Reference |
| --- | --- | --- |
| A-01 | Roles are `admin`, `employee`, `kiosk`, `viewer`; profile statuses are `pending`, `active`, `rejected`, `inactive`. | D-01 |
| A-02 | Only BHWs self-register; admin, kiosk and viewer accounts are created by an admin or `seed.sql`. | D-02 |
| A-03 | Each kiosk account is linked to exactly one station. | D-03 |
| A-04 | Email verification is required before an admin reviews a registration. | D-04 |
| A-05 | Each BHW has their own Android phone (Android 9 or later) with a working camera, GPS and mobile data or Wi-Fi at the office. | D-05, D-06 |
| A-06 | The office provides a tablet or monitor with a browser and stable internet for the kiosk. | D-34 |
| A-07 | QR tokens live 30 s and refresh every 15 s; nonces are single use per employee. | D-08 to D-10 |
| A-08 | One time-in and one time-out per day; overnight scans before 04:00 close the previous day. | D-13, D-14 |
| A-09 | Lateness counts from schedule start once the grace period is exceeded; undertime is early departure only; one stored status with fixed precedence. | D-15 to D-17 |
| A-10 | Scans on holidays and non-work days are accepted and never cause absences. | D-18 |
| A-11 | Default schedule is Monday–Friday 08:00–17:00 with a 15-minute grace period and a 12:00–13:00 break. | D-19 |
| A-12 | The end-of-day job runs at 04:05 Manila for the previous work date. | D-21 |
| A-13 | DTR undertime per day = minutes late + early-departure minutes; absent days count the full scheduled minutes. | D-22, D-23 |
| A-14 | Corrections are allowed for the current month, or the previous month during the first 5 days of the current month. | D-26 |
| A-15 | Contact number and address are encrypted with pgcrypto using a Supabase Vault key. | D-29 |
| A-16 | Retention periods follow D-32 (for example, attendance 5 years, error logs 180 days, selfies 30 days). | D-32 |
| A-17 | Email is sent through Resend only when `RESEND_API_KEY` is configured; otherwise notifications are in-app only. | D-33 |
| A-18 | The office address default is "Barangay Kalawag II, Isulan, Sultan Kudarat" and is editable in Settings. | Section M |

---

## 5. Constraints

| # | Constraint | Type |
| --- | --- | --- |
| C-01 | Backend must be Supabase (Auth, Postgres with RLS, Edge Functions in Deno/TypeScript, Realtime, Storage, pg_cron). | Technical |
| C-02 | Web must use Next.js App Router, TypeScript, Tailwind CSS and shadcn/ui as the primary design system. | Technical |
| C-03 | Mobile must use Expo with Expo Router and the five-library UI strategy defined in `development.md`, each library with one job. | Technical |
| C-04 | All attendance logic, reports and displayed times use Asia/Manila; device clocks are never trusted. | Business |
| C-05 | Must comply with the Data Privacy Act of 2012 (RA 10173) and its IRR: consent, proportionality, purpose limitation, retention limits, data-subject rights, breach notification. | Legal |
| C-06 | DTR output must follow the Civil Service Commission Form No. 48 layout. | Legal / business |
| C-07 | Must run on low-end Android phones (2 GB RAM, Android 9+) and on barangay internet that may be slow or intermittent. | Environmental |
| C-08 | Hosting must fit Supabase and Vercel free or low-cost tiers suitable for a barangay budget. | Budget |
| C-09 | Capstone timeline: all six phases delivered by one proponent; scope must stay within what can be built, tested and documented. | Schedule |
| C-10 | No biometric data may be stored anywhere in the system. | Legal / design (D-30) |

---

## 6. Stakeholders and users

| Entity | Type | Responsibility in the system | Access level | Main touchpoints |
| --- | --- | --- | --- | --- |
| BHW Staff (employee) | Primary user | Registers on the website, binds a phone, scans the kiosk QR to time in and time out, views own history and DTR, files correction requests, shows personal QR for fallback. | Own records only (role `employee`) | `/register`, `/me`, mobile app |
| Administrator | Primary user | Approves or rejects registrations, manages employees, schedules, holidays, stations and kiosks, reviews corrections, performs fallback scans and manual entries, resets devices, generates DTRs and reports, monitors device health, error logs and audit logs, edits settings. | Full access (role `admin`) | Admin portal |
| Kiosk / QR Station | System actor | Displays the rotating signed QR, sends heartbeats every 60 s, reports its own errors, shows recent scans for its station. | Issue QR tokens, send heartbeats, log errors, read own station feed (role `kiosk`, D-03) | `/kiosk/[stationId]` |
| System / Database (Supabase) | System actor | Validates scans, stores records, computes status, runs scheduled jobs, enforces RLS, pushes Realtime updates, writes audit and error logs. | Service role inside Edge Functions and SQL functions only | Postgres, Edge Functions, pg_cron, Realtime, Storage |
| Barangay Management (viewer) | Secondary user | Views authorized reports and the dashboard (read-only). | Read-only reports and dashboard (role `viewer`) | Viewer dashboard, Reports |

Other interested parties (not system users): the Barangay Data Protection Officer (receives privacy requests and breach reports), the municipal HR/accounting office (receives printed DTRs), the National Privacy Commission (breach notification within 72 hours), and the capstone adviser and panel.

> **System Administrator note:** The Data Protection Officer contact and the breach-notification procedure are documented in Phase 2 (privacy notice) and Phase 6 (incident response); this scope commits the system to support them.
