
# ROLE

You are a full product team working as one. Act as all five roles below and label which role is speaking in each section of your output:

1. **System Administrator**: environments, Supabase project setup, secrets, roles and permissions, backups, deployment, monitoring, data privacy compliance.
2. **System Analyst**: requirements, users, use cases, business rules, process flows, data dictionary, acceptance criteria.
3. **Software Engineer**: architecture, folder structure, shared types, coding standards, testing strategy, security design.
4. **Frontend Designer / Developer**: UI/UX for the web portal (Next.js + shadcn/ui Components and Blocks) and the mobile app (Expo + gluestack UI, React Native Reusables, Tamagui, React Native Paper, NativeWind).
5. **Backend Developer**: Supabase database schema, Row Level Security, SQL functions, Edge Functions, Realtime, scheduled jobs.

Do not skip a role. When a decision in one role affects another (for example, a schema change affecting a screen), say so.

---

# PROJECT CONTEXT

**Project:** BHW QR Attendance System (replaces the originally proposed fingerprint biometric system)
**Client setting:** Barangay Kalawag II Health Workers (BHW) Office, Philippines
**Proponent:** Janine Ariane Raganas, BSIT-2B

**Main problem:** Attendance is recorded manually in logbooks. Checking is slow, entries can be incomplete or inconsistent, and daily/weekly/monthly reports take a lot of manual work.

**Solution: QR attendance instead of biometrics**

- The employee (BHW) **registers first on the website**.
- The administrator **approves** the registration and assigns a schedule.
- The employee logs in to the **mobile application**, which is bound to their phone.
- The office has a **kiosk screen** (web page on a tablet/monitor) showing a **rotating, signed QR code**.
- The employee **scans the kiosk QR using the mobile app** to time in and time out.
- The system classifies attendance (on-time, late, absent, undertime, incomplete) and generates reports.
- **Supabase is the backend.**

**Users / entities**

| Entity                       | Responsibility                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| BHW Staff (employee)         | Registers on the website, scans with the mobile app to time in/out, views own history             |
| Administrator                | Approves registrations, manages employees, schedules, kiosks, corrections, reports, device resets |
| Kiosk / QR Station           | Displays the rotating QR code at the office                                                       |
| System / Database (Supabase) | Validates scans, stores records, computes status, updates reports in real time                    |
| Barangay Management (viewer) | Views authorized reports and dashboards (read-only)                                               |

**Design priorities:** Accuracy, Security, Privacy, Usability, Reliability.
**Timezone:** Asia/Manila for all attendance logic and reports.
**Compliance:** Philippine Data Privacy Act of 2012 (RA 10173): consent at registration, minimal data, role-based access, retention limits, audit trail.

---

# STUDY RECOMMENDATION (from the proposal)

> The proposed Biometric-Based Attendance System addresses the problems of manual attendance recording, slow identity verification, inaccurate time logs, and time-consuming attendance report preparation. I recommend integrating a biometric device with a centralized database to record employee time-in and time-out, verify identities, and automatically generate Daily Time Records (DTRs) and attendance reports. The system should include attendance classification based on approved work schedules, such as present, late, undertime, and absent, as well as alternative authentication methods for fingerprint recognition failures, biometric device health monitoring, and presentation-attack detection to help prevent fraudulent attendance. Additional features should include employee information management, attendance correction requests with approval workflows, device synchronization, error logging, and an administrator dashboard for monitoring personnel attendance. Role-based access, secure biometric data handling, encryption, and audit trails should also be implemented to protect sensitive employee information. These features can improve attendance accuracy, reduce administrative workload, strengthen personnel accountability, and support efficient attendance monitoring and DTR preparation.

**This build implements the recommendation using QR as the identity-verification device instead of a fingerprint scanner.** Every recommended feature must be delivered. Use this table as the checklist and include it, with a "Status" column, in the Phase 6 final summary:

| Recommended feature                                 | How this system implements it                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device + centralized database for time-in/time-out  | Kiosk QR station + mobile app, all records in Supabase Postgres                                                                                                                                                                                                                                     |
| Identity verification                               | Authenticated account + device binding + signed rotating QR + geofence; optional phone fingerprint/Face ID unlock                                                                                                                                                                                   |
| Automatic Daily Time Records (DTRs)                 | Monthly DTR per employee in the Civil Service Form No. 48 layout (AM arrival/departure, PM arrival/departure, undertime hours/minutes, totals, certification and "verified as to prescribed office hours" signature lines), printable and exportable to PDF; batch DTR generation for all employees |
| Attendance reports                                  | Daily, weekly, monthly summaries with CSV/PDF export                                                                                                                                                                                                                                                |
| Classification by approved schedule                 | Present (on time), late, undertime, absent, incomplete; computed from the employee's approved schedule and grace period                                                                                                                                                                             |
| Alternative authentication for verification failure | Personal rotating QR scanned by admin, or admin manual entry with reason                                                                                                                                                                                                                            |
| Device health monitoring                            | Kiosk heartbeat every 60s (online status, app version, last token issued, clock drift); mobile pre-scan health check; admin "Device Health" page with alerts when a kiosk goes offline                                                                                                              |
| Presentation-attack detection                       | QR expiry ~30s, single-use nonce, screenshot/replay rejection, device binding, geofence, scan cooldown, optional selfie, anomaly flags                                                                                                                                                              |
| Employee information management                     | Full employee CRUD: profile, BHW ID, area, contact, photo, schedule assignment, status, device                                                                                                                                                                                                      |
| Correction requests with approval workflow          | Employee files a request in the app or web (missing time-in/out, wrong time, official business) with reason and optional attachment → admin approves or rejects with remarks → approved changes update the record and DTR, all audited                                                            |
| Device synchronization                              | Kiosks and apps use server time (never the device clock); kiosk heartbeat; mobile caches history and re-syncs on reconnect; a `device-sync` API documented so a real fingerprint terminal can be added later without schema changes                                                               |
| Error logging                                       | `error_logs` table for Edge Function, kiosk and mobile errors (with severity and context), admin "Error Logs" page, failed scans in `scan_attempts`                                                                                                                                             |
| Administrator dashboard                             | Live dashboard with present/late/undertime/absent counts, trends, live scans, pending approvals and correction requests, device alerts                                                                                                                                                              |
| Role-based access                                   | Roles: admin, employee, kiosk, viewer, enforced by RLS and route middleware                                                                                                                                                                                                                         |
| Secure data handling + encryption                   | TLS everywhere; hashed device IDs; sensitive fields (contact number, address) encrypted at rest with pgcrypto / Supabase Vault keys; private storage with signed URLs; secrets only in Edge Function env; no biometric data stored                                                                  |
| Audit trails                                        | Triggers on every change to attendance, profiles, devices, corrections, schedules                                                                                                                                                                                                                   |

---

# FEATURE MAPPING (biometric proposal → QR system)

| Original biometric feature          | QR system equivalent                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Fingerprint enrollment              | Web registration + admin approval + one-time device binding on first mobile login                                                         |
| Fingerprint verification            | Scan of a signed, short-lived kiosk QR by an authenticated, device-bound app                                                              |
| Presentation Attack Detection (PAD) | Rotating QR (expires ~30s), single-use nonce, device binding, geofence check, screenshot/replay rejection, optional selfie                |
| Biometric Health Check              | Pre-scan check: camera, location permission and accuracy, internet, device still bound, with clear fix guidance                           |
| Periodic Biometric Verification     | Scheduled checks (pg_cron): unbound devices, missing schedules, anomalous scans, stale accounts                                           |
| Alternative Authentication          | (a) Employee shows a rotating personal QR that the admin scans from the web, or (b) admin manual entry with required reason; both audited |
| Optional biometric layer            | Phone's own fingerprint/Face ID (expo-local-authentication) unlocks the scan screen. No biometric data is stored                          |
| Smart Attendance Classification     | Automatic on-time / late / absent / undertime based on schedules and grace periods                                                        |

---

# TECH STACK

## Backend: Supabase

- Supabase Auth (email + password, email verification)
- Postgres with Row Level Security on every table
- Edge Functions (Deno, TypeScript) for QR token issuing and scan validation
- Realtime for live dashboard and kiosk feed
- Storage for profile photos and optional selfies (private bucket)
- pg_cron for absence marking, cleanup, periodic verification
- Generated TypeScript types shared by web and mobile

## Web (Admin portal + Registration + Kiosk)

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS** for all styling, using the shared design tokens
- **shadcn/ui** (set up with the shadcn CLI and `components.json`) as the design system foundation
- **shadcn/ui Components** for all core UI: Button, Card, Input, Label, Form, Select, Checkbox, Dialog, Sheet, Tabs, Table, Badge, Avatar, DropdownMenu, Calendar, Popover, Command, Sonner, Skeleton, Alert, Tooltip, Separator, Progress, Breadcrumb, Chart
- **shadcn/ui Blocks** as starting layouts: login/signup blocks (login, register), sidebar block (admin shell), dashboard block (admin dashboard), chart blocks (reports and trends)
- **Other design frameworks** (shadcn-compatible, Tailwind-based, added through the shadcn CLI or npm):

| Library                                   | Role on the web                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Magic UI**                        | Landing/registration page polish only: animated number counters on dashboard stat cards, subtle animated borders on the kiosk QR card |
| **Aceternity UI**                   | Registration/login left panel background effect only (keep it light; never on data pages)                                             |
| **Motion (Framer Motion)**          | Page and dialog transitions, live-scan list item enter animation, kiosk QR refresh fade                                               |
| **Lucide React**                    | All icons (same icon set as shadcn)                                                                                                   |
| **Recharts** (through shadcn Chart) | All charts                                                                                                                            |
| **next-themes**                     | Light/dark mode toggle                                                                                                                |

Web rules:

- shadcn/ui is always the primary choice; use another framework only for the role listed above, and never two libraries for the same component type.
- Every extra framework must use the same Tailwind tokens (colors, radius, font) so the look stays consistent with shadcn.
- Animations must respect `prefers-reduced-motion` and must never slow down data pages, tables or the kiosk.
- If any of these frameworks is unavailable or conflicts with the current Next.js/Tailwind version, explain it and propose the closest shadcn-compatible replacement.
- **Supporting libraries:** TanStack Table (shadcn data-table pattern), react-hook-form + zod, `@supabase/ssr`, `qrcode.react` (kiosk QR), `html5-qrcode` or `@yudiel/react-qr-scanner` (admin fallback scan page), CSV export, `@react-pdf/renderer` for DTR and report PDFs

## Mobile (Employee app): Expo / React Native

- Expo (latest SDK) + Expo Router + TypeScript
- `expo-camera` (CameraView barcode scanning), `expo-location`, `expo-secure-store`, `expo-local-authentication`, `expo-device`, `expo-application`
- TanStack Query

### Mobile UI library strategy (follow exactly)

All five libraries are used, but each has ONE job so they do not conflict. Document this table in the README.

| Library                          | Role                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **NativeWind**             | Styling foundation: all layout, spacing, color, typography via Tailwind classes, sharing tokens with web                          |
| **React Native Reusables** | Primary components (shadcn port): Button, Card, Input, Label, Avatar, Badge, Tabs, Dialog, Separator, Progress, Text              |
| **gluestack UI v2**        | Toast, Actionsheet, FormControl with validation messages, Spinner, Skeleton                                                       |
| **React Native Paper**     | FAB (Scan button), Snackbar (offline notice), SegmentedButtons (history filter) only; PaperProvider theme mapped to shared tokens |
| **Tamagui**                | Animated scan result overlay and attendance detail bottom sheet only; Tamagui config mapped to shared tokens                      |

Rules:

- Never use two libraries for the same component type.
- Define palette, radius and fonts ONCE in `packages/design-tokens` and map into Tailwind (web + NativeWind), Paper theme and Tamagui config.
- Light and dark mode on both platforms.
- If a library combination causes build/runtime errors, explain the error and propose the smallest fix instead of silently removing the library.

---

# VISUAL REFERENCE

- **Palette:** shadcn neutral (zinc). Background #ffffff / #fafafa, text #09090b, muted text #71717a, borders #e4e4e7, primary buttons #18181b, accent (health teal) #0f766e.
- **Status badges:** On time #dcfce7 / #166534; Late #fef3c7 / #92400e; Absent #fee2e2 / #991b1b; No time-out #f4f4f5 / #3f3f46.
- **Font:** Inter. Radius: 6px inputs/buttons, 12px web cards, 16px mobile cards, full-round badges.

---

# PROJECT STRUCTURE (monorepo, Turborepo + pnpm)

```
/apps/web                 Next.js admin portal, registration, kiosk
/apps/mobile              Expo employee app
/packages/types           Generated Supabase types + shared zod schemas
/packages/design-tokens   Colors, radius, typography for both apps
/supabase                 migrations, seed.sql, functions/, config.toml
```

---

# CORE FLOWS

1. **Registration (web):** full name, BHW ID number, purok/area, contact number, email, password, profile photo, required Data Privacy consent → `status = 'pending'` → admin approves (assigns schedule) or rejects with reason → email notification.
2. **Device binding (mobile, first login):** block if not `active`; register hashed device ID in SecureStore; one active device per employee; second phone blocked until admin resets.
3. **Kiosk QR (`/kiosk/[stationId]`):** kiosk role calls `issue-qr-token` every 15s; token `{station_id, nonce, issued_at, expires_at}` signed with HMAC-SHA256 (server-only secret), lifetime 30s; full-screen QR, countdown, Manila clock, live feed of recent scans via Realtime.
4. **Scan to attend (mobile):** optional phone biometric unlock → pre-scan health check → scan → call `record-attendance` with token, device_id, lat, lng, accuracy. Validation order: auth → active status → device match → signature → expiry → nonce reuse → geofence (default 100 m) → cooldown (default 5 min). Decide time-in or time-out, compute status, write record, log every attempt to `scan_attempts`, return friendly message + error code. App shows animated success/failure overlay.
5. **Fallback:** rotating personal QR scanned by admin on the web (`method = 'fallback_personal_qr'`), or admin manual entry with required reason (`method = 'manual'`). Both audited.
6. **Correction requests:** employee files a request (type: missing time-in, missing time-out, wrong time, official business/field work) with date, requested time, reason, optional attachment → status `pending` → admin approves or rejects with remarks → on approval the attendance record and DTR update automatically; the employee is notified; everything is audited.
7. **DTR generation:** admin or employee selects a month → system builds the Civil Service Form No. 48 DTR from attendance records (AM/PM arrival and departure, undertime per day, monthly totals) → print / PDF; admin can batch-generate DTRs for all employees.
8. **Device health & sync:** kiosk sends a heartbeat every 60s to `kiosk-heartbeat` (version, last token, clock drift); kiosk marked offline after 3 missed heartbeats and the admin dashboard shows an alert; all times use server time.
9. **Error logging:** Edge Functions, kiosk and mobile app report errors to `log-error` → `error_logs` (source, severity, message, context, user, created_at).
10. **Scheduled jobs (pg_cron):** end-of-day absence and undertime marking (skip holidays/non-work days), flag missing time-outs, hourly nonce cleanup, kiosk offline detection, weekly periodic verification report, selfie retention cleanup.

---

# DATABASE

Tables (uuid keys, timestamptz, Asia/Manila date logic):

- `profiles` (id → auth.users, full_name, bhw_id_number unique, area, contact_number, photo_url, role: admin | employee | kiosk | viewer, status: pending | active | rejected | inactive, rejection_reason, consent_at, created_at)
- `schedules` (id, name, work_days int[], start_time, end_time, grace_minutes, created_by)
- `employee_schedules` (employee_id, schedule_id, effective_from, effective_to)
- `stations` (id, name, latitude, longitude, radius_m, is_active)
- `devices` (id, employee_id, device_id_hash, platform, model, bound_at, revoked_at)
- `qr_nonces` (nonce, station_id, issued_at, expires_at)
- `attendance_records` (id, employee_id, work_date, time_in, time_out, station_id, status: on_time | late | absent | undertime | incomplete, minutes_late, method: qr | fallback_personal_qr | manual, notes, created_by)
- `scan_attempts` (id, employee_id, station_id, success, failure_reason, lat, lng, accuracy, device_id_hash, created_at)
- `audit_logs` (id, actor_id, action, table_name, record_id, old_data jsonb, new_data jsonb, created_at)
- `holidays` (date, name)
- `app_settings` (geofence radius, cooldown, token lifetime, selfie on/off)
- `correction_requests` (id, employee_id, attendance_record_id nullable, work_date, type, requested_time_in, requested_time_out, reason, attachment_url, status: pending | approved | rejected, reviewed_by, reviewed_at, remarks, created_at)
- `kiosk_heartbeats` (id, station_id, app_version, clock_drift_ms, last_token_at, created_at) plus `stations.last_seen_at` and `stations.is_online`
- `error_logs` (id, source: edge_function | kiosk | mobile | web, severity: info | warning | error | critical, message, context jsonb, user_id, created_at)
- `undertime_minutes` column on attendance_records, and a `dtr_month` SQL view / RPC that returns the CSC Form 48 rows per employee per month

Rules: RLS on every table; employees see only their own rows and can only create/cancel their own pending correction requests; admin full access; viewer read-only on reports; kiosk can only issue QR tokens and send heartbeats; attendance inserts ONLY through Edge Functions or approved corrections; audit triggers on attendance_records, profiles, devices, correction_requests, schedules. Encrypt sensitive profile fields at rest (pgcrypto with keys in Supabase Vault).

---

# SCREENS

**Web (shadcn/ui):** `/login`, `/register`, `/pending`, `/rejected`, `/privacy`; admin sidebar layout with Dashboard (stat cards Present/Late/Absent/Total, weekly stacked bar chart, live scans, today's table), Employees, Pending Approvals, Attendance Records, Correction Requests (approve/reject with remarks), DTR (CSC Form 48, single or batch, print/PDF), Reports (Daily/Weekly/Monthly printable with barangay header), Schedules, Stations & Kiosks, Device Health, Holidays, Fallback Scan, Error Logs, Audit Log, Settings; dashboard also shows undertime count, pending corrections and device alerts; viewer read-only dashboard; employee `/me`; `/kiosk/[stationId]` full-screen dark kiosk.

**Mobile:** Login, Blocked (pending/rejected/inactive), Bind Device, Home (greeting, Today card, This Week progress, Recent, Paper FAB Scan, bottom tabs Home/History/My QR/Profile), Scan (dark camera, teal viewfinder, health check bottom sheet), Scan Result (animated Tamagui overlay), History (Paper SegmentedButtons, Tamagui detail sheet, "Request correction" action), Correction Request form (gluestack FormControl + Actionsheet for type) and My Requests list with status, My DTR (monthly view + download PDF), My QR (rotating personal QR), Profile & Settings (dark mode, biometric unlock toggle, English/Filipino, privacy notice, logout).

UX rules: plain-language messages (English + optional Filipino), touch targets ≥ 44px, loading/empty/error states everywhere, works on low-end Android.

---

# PHASES

Complete ALL six phases in order. At the end of each phase, give a short summary (what was built, how to run it), then continue to the next phase. If your output is cut off, continue exactly where you stopped when I say "continue". Write complete, working code with file paths (no placeholders like "// add logic here"). Use strict TypeScript. State any assumption you make.

## Phase 1 – System Analysis (System Analyst)

1. Scope statement (in scope / out of scope).
2. Functional requirements (FR-01...) grouped by module: Registration, Employee Information Management, Approval, Device Binding, Kiosk QR, Scan Attendance, Fallback, Correction Requests, DTR, Reports, Schedules, Stations & Device Health, Device Sync, Error Logging, Audit, Settings. Trace every FR back to the Study Recommendation table.
3. Non-functional requirements (NFR-01...): performance, security, privacy (RA 10173), usability, reliability, compatibility.
4. Use case table: ID, actor, use case, precondition, main flow, alternate flows, postcondition, for every actor.
5. Business rules (BR-01...): time-in vs time-out decision, status computation with grace period, undertime computation, cooldown, scans after midnight, forgotten time-out, holidays, schedule changes, device binding/reset, fallback and manual entry, correction request eligibility (e.g. within the same DTR month) and approval, DTR AM/PM split and totals.
6. Mermaid flowcharts: registration and approval, device binding, scan to attend (with every failure branch), fallback, correction request approval, DTR generation, kiosk health monitoring, end-of-day job.
7. Mermaid context diagram and Level-1 DFD.
8. Mermaid ERD.
9. Data dictionary (table, column, type, constraint, description, sample).
10. Risk list with mitigations.

## Phase 2 – Architecture & Setup (Software Engineer + System Administrator)

- Mermaid architecture diagram.
- Monorepo scaffold with all root configs (package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, ESLint, Prettier).
- `packages/design-tokens` exported for Tailwind, NativeWind, Paper theme, Tamagui config.
- `packages/types` zod schemas (registration, scan request/response, attendance record, report filters).
- Coding standards, branch strategy, testing strategy.
- Supabase setup steps (auth, redirect URLs, deep links, storage buckets), Supabase CLI local dev.
- `.env.example` for web, mobile and Edge Functions with server-only variables clearly marked.
- Roles × modules access matrix, backup/restore plan, HMAC secret rotation, retention schedule, consent and privacy notice text.
- Web scaffold: Next.js + shadcn/ui initialized (`components.json`), Supabase SSR helpers, theme provider.
- Mobile scaffold: Expo Router + NativeWind + React Native Reusables + gluestack UI v2 + PaperProvider + TamaguiProvider, with the exact provider nesting order in `app/_layout.tsx` explained, plus babel, metro, tailwind configs and global.css.
- README with setup and run steps.

## Phase 3 – Backend (Backend Developer)

- Timestamped migrations: enums, all tables, indexes, unique constraints, profile-on-signup trigger.
- Helper SQL functions: `is_admin()`, `current_role()`, `manila_today()`, `compute_attendance_status()`, `haversine_distance_m()`.
- RLS policies for every table and role, each explained in one line.
- Audit triggers.
- Report RPCs: `get_daily_summary`, `get_weekly_summary`, `get_monthly_summary`, `get_employee_history`, `get_dashboard_today`.
- Admin RPCs: approve_employee, reject_employee, reset_device, deactivate_employee, manual_attendance_entry (reason required), review_correction_request (approve/reject with remarks; approval updates the record in one transaction).
- DTR RPC: `get_dtr(employee_id, year, month)` returning CSC Form 48 rows and totals; `get_dtr_batch(year, month)`.
- Edge Functions: `issue-qr-token`, `record-attendance`, `bind-device`, `issue-personal-qr`, `record-fallback-scan`, `kiosk-heartbeat`, `log-error`, `device-sync` (documented contract for a future fingerprint terminal), `generate-dtr-pdf`, plus `_shared/` (CORS, HMAC, admin client, error codes, rate limiter).
- pg_cron jobs, Realtime setup and subscription filters.
- `seed.sql`: 1 admin, 1 kiosk, 1 viewer, 8 BHWs with Filipino names, 1 station, schedule Mon–Fri 08:00–17:00 with 15-min grace, 2 PH holidays, 2 weeks of realistic attendance (late, absent, incomplete cases).
- Type generation command; pgTAP tests for RLS and status logic; Deno tests for every `record-attendance` failure.

## Phase 4 – Web Application (Frontend Designer / Developer)

- Short design spec and Mermaid sitemap.
- All web screens listed above, built with shadcn/ui Components and Blocks, matching the Visual Reference.
- Middleware route protection by role, Server Actions for admin RPCs, Sonner toasts, accessibility (labels, focus, keyboard, contrast).
- Kiosk: QR refresh every 15s, countdown bar, Manila clock (server time), Realtime recent scans, offline banner, heartbeat every 60s, errors reported to `log-error`.
- DTR page: exact CSC Form 48 printable layout (A4/legal), batch print.
- Playwright tests: register → approve → login; kiosk QR refresh; report generation.

## Phase 5 – Mobile Application (Frontend Designer / Developer)

- Screen flow diagram (Mermaid) and wireframe description per screen.
- All mobile screens listed above, following the Mobile UI library strategy exactly.
- Supabase client with SecureStore session, auth guard by status, TanStack Query, offline Snackbar (never queue scans offline; explain why).
- Error code → friendly message map in English and Filipino; haptics on scan.
- `eas.json` (development, preview, production) and app.json permission texts for camera and location.
- Jest + React Native Testing Library tests for scan result handling and health check logic.

## Phase 6 – Testing, Deployment & Documentation (all roles)

- **System Analyst:** test case table (valid time-in/out, late, undertime, correction request approve/reject, DTR totals match records, kiosk offline alert, error logged, expired QR, reused QR, screenshot replay, wrong device, outside geofence, poor GPS, duplicate scan, pending/rejected/inactive account, holiday, forgotten time-out, fallback, manual entry, report totals) and a UAT form with a 5-point scale.
- **Software Engineer:** test commands and coverage targets, security checklist (OWASP basics), performance checks (dashboard update < 2s, scan response < 3s).
- **Backend Developer:** production migrations, deploy Edge Functions, set secrets, enable cron, verify RLS per role.
- **Frontend Developer:** deploy web to Vercel, kiosk tablet setup in full-screen mode, Android APK/AAB with EAS Build, EAS Update for OTA.
- **System Administrator:** go-live checklist, admin account creation, station coordinates at the BHW office, monitoring, backups, incident response, secret rotation, offboarding.
- **Documentation:** admin manual, one-page BHW staff quick guide (English with Filipino terms), kiosk setup guide, final README.
- **Final summary table:** original problem → feature that solves it → acceptance criteria result.
- **Recommendation compliance table:** every row of the Study Recommendation table with Status (Done / Partial / Not done) and where it is implemented.

---

# ACCEPTANCE CRITERIA

- A pending user cannot use the mobile app.
- A kiosk QR screenshot older than 30 seconds is rejected.
- The same QR cannot be used twice by the same user.
- Scans outside the geofence are rejected with a clear message.
- The admin dashboard updates within 2 seconds of a successful scan.
- Daily/weekly/monthly reports match the raw records exactly.
- Every manual correction appears in the audit log with a reason.
- An approved correction request updates the attendance record and the DTR automatically.
- The generated DTR follows the CSC Form 48 layout and its totals (including undertime) match the records.
- A kiosk that stops sending heartbeats is shown as offline on the dashboard within 3 minutes.
- Errors from Edge Functions, kiosk and mobile app appear in Error Logs.
- Sensitive profile fields are encrypted at rest and no biometric data is stored.

Begin with Phase 1 now.
