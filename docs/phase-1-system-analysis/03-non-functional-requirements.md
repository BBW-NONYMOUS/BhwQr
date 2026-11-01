> **Role speaking: System Analyst**

# 03 – Non-Functional Requirements

This document lists the quality requirements (NFR) of the BHW QR Attendance System. Each requirement has a measurable acceptance target and a verification method so it can be checked in Phase 6 testing and UAT. Decisions D-xx refer to [`00-assumptions-and-decisions.md`](./00-assumptions-and-decisions.md); FR-xx refer to [`02-functional-requirements.md`](./02-functional-requirements.md).

All times are Asia/Manila. "p95" means 95 out of 100 measured requests are at or below the target.

**Reference test conditions** (used by every performance measure unless stated otherwise):

| Item | Value |
| --- | --- |
| Data volume | Seed data plus 1 year of simulated attendance: 100 employees, 3 stations, about 26,000 attendance records, about 40,000 scan attempts |
| Mobile device | Low-end Android phone, 2 GB RAM, Android 9, 4G or office Wi-Fi with at least 5 Mbps down / 1 Mbps up |
| Kiosk | Android tablet (8 inches or larger) or PC with Chrome, office Wi-Fi |
| Admin browser | Chrome (latest) on a laptop, 10 Mbps connection |
| Backend | Supabase project in the Singapore region (`ap-southeast-1`), closest to the Philippines |

## Summary

| Category | NFR range | Count |
| --- | --- | --- |
| Performance | NFR-01 – NFR-09 | 9 |
| Security | NFR-10 – NFR-21 | 12 |
| Privacy (RA 10173) | NFR-22 – NFR-33 | 12 |
| Usability | NFR-34 – NFR-44 | 11 |
| Reliability / Availability | NFR-45 – NFR-52 | 8 |
| Compatibility | NFR-53 – NFR-59 | 7 |
| Maintainability | NFR-60 – NFR-67 | 8 |
| Auditability | NFR-68 – NFR-73 | 6 |
| **Total** | NFR-01 – NFR-73 | **73** |

---

## Performance

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-01 | Performance | The admin dashboard shall reflect a successful scan (stat cards and live scans list) quickly through Realtime. | Within 2 s of the `record-attendance` commit, p95 over 20 consecutive scans; no page reload. | Playwright test that commits scans through the API and measures the time until the new row and updated count render; Realtime timestamps compared in the test log. |
| NFR-02 | Performance | A scan shall complete quickly from QR decode to result overlay on the phone. | End-to-end ≤ 3 s p95 on the reference mobile device; `record-attendance` server execution ≤ 800 ms p95. | Instrumented mobile build logging decode-to-overlay time over 50 scans; Edge Function duration from Supabase logs; k6 load test of 30 scans/min. |
| NFR-03 | Performance | The kiosk QR shall refresh on time so the displayed code is always valid. | New token requested every 15 s (± 1 s); new QR rendered within 1 s of the response; `issue-qr-token` ≤ 500 ms p95; no displayed token older than 30 s. | Playwright kiosk test over 10 minutes recording token `iat` and render time; Edge Function logs. |
| NFR-04 | Performance | Reports and DTRs shall generate quickly at the reference data volume. | Daily, weekly and monthly report ≤ 3 s; single DTR (screen or PDF) ≤ 3 s; batch DTR PDF for 100 employees ≤ 60 s with a progress indicator; CSV export of one month ≤ 5 s. | Timed Playwright report test; `EXPLAIN ANALYZE` of report RPCs on the reference data set. |
| NFR-05 | Performance | Web pages shall load quickly. | Admin pages Largest Contentful Paint ≤ 2.5 s; kiosk page ready to show the first QR ≤ 3 s; `/register` usable ≤ 3 s on a 4G phone. | Lighthouse (desktop and mobile profiles) on the production build. |
| NFR-06 | Performance | The mobile app shall start and open the camera quickly on low-end phones. | Cold start to Home ≤ 4 s; Scan screen camera ready ≤ 2 s; scrolling History stays above 30 frames per second. | Manual timing on the reference device (5 runs, median reported); React Native performance monitor. |
| NFR-07 | Performance | The system shall handle the morning rush at shift start. | 100 employees scanning within 15 minutes (burst of 30 scans per minute) with 0 `INTERNAL_ERROR` responses and p95 still ≤ 3 s. | k6 load test against a staging project with the reference data set. |
| NFR-08 | Performance | Database queries used by screens and Edge Functions shall be indexed. | No RPC or Edge Function query above 500 ms at the reference data volume; every foreign key and every filter column used by reports has an index. | `EXPLAIN ANALYZE` review in Phase 3; Supabase query performance report before go-live. |
| NFR-09 | Performance | The mobile app shall use little mobile data. | Scan request ≤ 5 KB without selfie; selfie compressed to ≤ 300 KB; History screen ≤ 100 KB per month of data. | Network inspector measurement on the reference device. |

## Security

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-10 | Security | All traffic shall be encrypted in transit. | TLS 1.2 or higher on web, Edge Functions, Realtime and Storage; HTTP redirects to HTTPS; HSTS header on the web portal. | SSL Labs test (grade A or better); header check with `curl -I`. |
| NFR-11 | Security | Row Level Security shall be enabled on every table with default deny. | 100% of tables in the `public` schema have RLS enabled; every role (admin, employee, kiosk, viewer, anonymous) has pgTAP tests for allowed and denied access. | pgTAP test suite; SQL check that `relrowsecurity = true` for every public table. |
| NFR-12 | Security | Secrets shall never reach client code. | `QR_SIGNING_SECRET`, `QR_SIGNING_SECRET_PREVIOUS`, `PERSONAL_QR_SIGNING_SECRET`, `DEVICE_HASH_PEPPER`, `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` exist only in Edge Function / server environment; 0 occurrences in web bundles, mobile bundles or the repository. | Secret scanner (gitleaks) in CI; text search of the built web and mobile bundles. |
| NFR-13 | Security | QR tokens and device hashes shall use strong cryptography. | HMAC-SHA256 with secrets of at least 32 random bytes; signature comparison in constant time; nonces are UUID v4. | Code review of `_shared/hmac.ts`; Deno unit tests for tampered, truncated and wrong-key tokens. |
| NFR-14 | Security | Authentication shall be handled by Supabase Auth with safe defaults. | Email confirmation on (D-04); minimum password length 8; access tokens expire after 1 hour with refresh; logout revokes the refresh token; Supabase Auth rate limits enabled. | Supabase Auth settings checklist in Phase 6; Playwright test that a logged-out token cannot call an RPC. |
| NFR-15 | Security | Abuse-prone endpoints shall be rate limited. | `record-attendance` 10 requests/minute/user returns `RATE_LIMITED` (429); `log-error` and `issue-personal-qr` limited per user; `issue-qr-token` limited to the kiosk account. | Deno tests that exceed each limit and expect HTTP 429. |
| NFR-16 | Security | Every server entry point shall validate its input. | 100% of Edge Functions and Server Actions validate the body with the shared zod schemas and return `INVALID_REQUEST` (400) on failure; SQL uses parameters only, never string concatenation. | Deno tests with malformed bodies; code review checklist. |
| NFR-17 | Security | Stored files shall be private. | Buckets `profile-photos`, `selfies` and `correction-attachments` are private; signed URLs expire in ≤ 60 minutes; uploads checked for MIME type and size (≤ 5 MB) (D-31). | Attempt to open a file path without a signed URL (expect 400/403); storage policy pgTAP tests. |
| NFR-18 | Security | Sensitive profile fields shall be encrypted at rest. | `contact_number_enc` and `address_enc` are `bytea` encrypted with `pgp_sym_encrypt`; the key is stored only in Supabase Vault (`profile_encryption_key`), never in migrations or code (D-29). | SQL check that raw columns contain no readable text; pgTAP test that `get_profile_private` returns plain text only to the owner and admins. |
| NFR-19 | Security | The web portal shall follow the OWASP Top 10 basics. | Security headers present (Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, frame-ancestors none); no high or critical findings in dependency audit; no reflected or stored XSS in user-entered fields. | OWASP ZAP baseline scan; `pnpm audit`; Phase 6 security checklist. |
| NFR-20 | Security | Only active accounts with the right role shall reach protected functions. | 100% of admin RPCs call `is_admin()`; 100% of Edge Functions check role and status server-side; middleware redirects every protected route for the wrong role. | pgTAP and Deno tests per role; Playwright role-routing tests. |
| NFR-21 | Security | Signing secrets shall be rotatable without downtime. | Rotation with a 60 s overlap (D-11) causes 0 failed valid scans; rotation done at least once a year and immediately after any suspected leak. | Rotation drill in staging during Phase 6; rotation record in the admin manual. |

## Privacy (RA 10173 – Data Privacy Act of 2012)

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-22 | Privacy | Personal data shall be processed only after informed consent. | Registration cannot be submitted without ticking the consent box; `consent_at` is set for 100% of employee profiles; the privacy notice shows its version and effective date. | Playwright test (submit without consent fails); SQL check for null `consent_at` on employee profiles. |
| NFR-23 | Privacy | The system shall collect only the minimum data needed (proportionality). | Collected fields are limited to those in FR-01; no biometric data stored anywhere (D-30); location is captured only at the moment of a scan, never in the background; raw device IDs never stored (D-05). | Data dictionary review against FR-01; mobile permission review (no background location permission requested). |
| NFR-24 | Privacy | Personal data shall be used only for the declared purpose. | Data is used only for attendance, DTR, reports and account management; only the processors named in the privacy notice (Supabase, Vercel, Resend) receive data; no analytics or advertising SDKs in web or mobile. | Dependency review of web and mobile bundles; privacy notice review by the DPO. |
| NFR-25 | Privacy | Data shall be kept no longer than the retention schedule. | Retention follows D-32 exactly (nonces 1 day, selfies 30 days, heartbeats 30 days, error logs 180 days, scan attempts 1 year, notifications 1 year, rejected registrations 90 days, attendance/corrections/audit 5 years); 0 rows older than their limit after the daily cleanup job. | pgTAP test of the cleanup job with back-dated rows; monthly SQL spot check. |
| NFR-26 | Privacy | Data subjects shall be able to access their data. | An employee can view all their personal data in `/me` and the app at any time (FR-19); requests for a full copy are answered by the DPO within 15 calendar days. | UAT task; DPO request log. |
| NFR-27 | Privacy | Data subjects shall be able to correct their data. | Employees edit contact data directly (FR-18) and request attendance changes through correction requests (FR-68); other profile corrections are handled by the admin within 5 working days. | UAT task; review of request timestamps in the audit log. |
| NFR-28 | Privacy | Data subjects shall be able to request erasure or blocking. | On a verified request from a former employee, photo, contact number and address are erased within 15 calendar days (FR-20); records the office must keep (attendance, DTR source data, audit) are retained until their D-32 limit and the reason is explained to the requester. | Functional test of the erasure action; DPO request log. |
| NFR-29 | Privacy | Personal data breaches shall be reported on time. | A documented incident response procedure notifies the National Privacy Commission and affected data subjects within 72 hours of knowledge of a breach involving sensitive personal information or data that may enable identity fraud (NPC Circular 16-03); every incident is recorded in a breach log. | Tabletop exercise in Phase 6; review of the incident response document. |
| NFR-30 | Privacy | A Data Protection Officer shall be designated and privacy risk assessed. | DPO (or Compliance Officer for Privacy) named with contact details in the privacy notice; a Privacy Impact Assessment completed and signed before go-live. | Go-live checklist sign-off. |
| NFR-31 | Privacy | Each role shall see only the personal data it needs. | Viewers see aggregated reports and names only (no contact data, photos or locations); the kiosk feed shows first name only; employees see only their own rows. | pgTAP RLS tests; Playwright viewer tests; kiosk screenshot review. |
| NFR-32 | Privacy | Scan location data shall be limited. | Latitude, longitude and accuracy are stored only in `scan_attempts`, shown only to admins, and deleted after 1 year (D-32). | pgTAP RLS test; retention job test. |
| NFR-33 | Privacy | Optional selfies shall be protected and short-lived. | Selfies only when `selfie_required = true`, stored in the private `selfies` bucket, visible only to admins via signed URL, deleted after `selfie_retention_days` (default 30). | Storage policy test; retention job test with a back-dated file. |

## Usability

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-34 | Usability | All interactive elements shall be easy to tap. | Touch targets at least 44 × 44 px on mobile and on touch layouts of the web; at least 8 px between adjacent targets. | Design review with layout inspector; accessibility scanner on Android. |
| NFR-35 | Usability | The mobile app and employee-facing web pages shall be bilingual. | 100% of mobile strings and every error code have English and Filipino text; `/register`, `/pending`, `/rejected`, `/privacy` and `/me` offer both languages; the user's choice is remembered. | Jest test that every key exists in both locale files; UAT with BHWs. |
| NFR-36 | Usability | Messages shall use plain language and say what to do next. | Every error message states what happened and the next step (for example, "You are too far from the office. Move closer to the BHW office and scan again."); no technical codes shown alone to employees. | Copy review against the error code map; UAT rating on clarity ≥ 4 out of 5. |
| NFR-37 | Usability | The app shall work well on low-end Android phones. | Runs on Android 9+ with 2 GB RAM and a 720 × 1280 screen without crashes during a 30-minute session; app download size ≤ 60 MB. | Manual test on the reference device; EAS build size report. |
| NFR-38 | Usability | Every screen shall have loading, empty and error states. | 100% of data screens on web and mobile show a skeleton or spinner while loading, an explanatory empty state, and an error state with a retry action. | Screen checklist review in Phases 4 and 5; component tests. |
| NFR-39 | Usability | The interfaces shall be accessible. | WCAG 2.2 AA: text contrast ≥ 4.5:1, every input has a label, full keyboard navigation and visible focus on the web, screen-reader labels on mobile icons and buttons, status badges not shown by color alone. | axe-core in Playwright; manual TalkBack check of the scan flow. |
| NFR-40 | Usability | A routine scan shall be fast for the employee. | A trained employee completes a time-in from opening the app to seeing the result in ≤ 10 s (median of 10 tries). | Timed UAT task. |
| NFR-41 | Usability | New users shall complete onboarding without help. | At least 4 out of 5 test BHWs register, get approved and bind their phone without assistance; average UAT ease-of-use score ≥ 4 out of 5. | UAT form (5-point scale) in Phase 6. |
| NFR-42 | Usability | The kiosk shall be readable from where employees stand. | QR occupies at least 60% of the shorter screen side; clock text at least 48 px; QR scans successfully from 0.3–1.0 m. | Kiosk test on the office tablet with 3 different phones. |
| NFR-43 | Usability | Motion shall never hinder use. | All animations honor `prefers-reduced-motion` (web) and the OS reduce-motion setting (mobile); no animation on tables, reports or kiosk delays content by more than 300 ms. | Manual test with reduced motion turned on. |
| NFR-44 | Usability | Dates and times shall be shown consistently in Manila time. | Every displayed time uses Asia/Manila and the same format (for example, "Mon, 3 Nov 2026, 8:05 AM"); 0 screens show UTC or device-local time. | Test with the phone and browser set to a non-Manila timezone. |

## Reliability / Availability

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-45 | Reliability | The system shall be available during office use. | ≥ 99% monthly availability between 06:00 and 20:00 Manila (excluding announced maintenance and provider outages outside the project's control). | Uptime monitor on the web portal and a health endpoint; Supabase status history. |
| NFR-46 | Reliability | Valid scans at the edge of a QR refresh shall not fail. | Two tokens are valid at once (30 s lifetime, 15 s refresh, D-09); 0 `QR_EXPIRED` results for scans submitted within the token lifetime. | Deno test with scans at 14, 15, 16 and 29 s after `iat`. |
| NFR-47 | Reliability | Attendance writes shall be atomic and never duplicated. | Each scan, fallback, manual entry and correction approval runs in one transaction; a unique constraint ensures at most one attendance record per employee per work date; 0 duplicates after the load test in NFR-07. | pgTAP constraint test; SQL duplicate check after load test. |
| NFR-48 | Reliability | The kiosk shall recover from network loss by itself. | After the connection returns, a valid QR is shown and a heartbeat sent within 15 s, without reloading the page by hand. | Manual test: disable Wi-Fi for 2 minutes, then re-enable. |
| NFR-49 | Reliability | Data shall be backed up and restorable. | Daily database backup kept at least 7 days (Supabase backups or scheduled `pg_dump`); recovery point objective 24 h; recovery time objective 4 h; restore tested once before go-live and every 3 months. | Restore drill into a staging project with record-count comparison. |
| NFR-50 | Reliability | Scheduled jobs shall be safe to re-run. | Running the end-of-day job twice for the same date creates 0 extra rows; a missed run can be executed manually for any past date. | pgTAP test running the job twice. |
| NFR-51 | Reliability | Unexpected server errors shall be rare. | `INTERNAL_ERROR` below 1% of `record-attendance` requests per month; every one appears in `error_logs`. | Monthly query on `scan_attempts` and `error_logs`. |
| NFR-52 | Reliability | Failure of optional services shall not block core work. | If email sending fails, approvals and correction reviews still complete and the in-app notification is still created; the failure is logged in `error_logs`. | Test with an invalid `RESEND_API_KEY`. |

## Compatibility

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-53 | Compatibility | The web portal shall support current browsers. | Latest two major versions of Chrome, Edge, Firefox and Safari; Chrome for Android for `/register`, `/me` and `/pending`. | Playwright runs on Chromium, Firefox and WebKit; manual check on Chrome for Android. |
| NFR-54 | Compatibility | The mobile app shall support the Android versions BHWs use. | Android 9 (API 28) and later; target SDK equal to Google Play's current requirement. | EAS build config review; install test on Android 9 and the latest Android. |
| NFR-55 | Compatibility | The mobile app shall be buildable for iOS (publishing optional). | iOS 15+ build runs in the simulator with the same features; App Store publishing is out of scope for this release. | EAS iOS simulator build in Phase 5. |
| NFR-56 | Compatibility | The kiosk shall run on common office hardware. | Android tablet (8 inches or larger, Chrome) or a PC with Chrome/Edge in kiosk/full-screen mode; minimum resolution 1280 × 800; works in landscape and portrait. | Kiosk setup guide test on at least one tablet and one PC. |
| NFR-57 | Compatibility | Web layouts shall adapt to screen size. | Admin portal fully usable from 1024 px wide; registration, pending, rejected, privacy and `/me` pages usable from 360 px wide with no horizontal scrolling. | Playwright screenshots at 360, 768, 1024 and 1440 px. |
| NFR-58 | Compatibility | DTR and reports shall print correctly. | DTR prints on A4 and legal paper with the CSC Form 48 layout on one page per employee; reports print with the barangay header on every page. | Print-to-PDF check in Chrome and Edge; physical test print at the office. |
| NFR-59 | Compatibility | QR scanning shall work with ordinary phone cameras. | Kiosk QR decoded by phones with a rear camera of 5 MP or more under normal office lighting within 2 s. | Test with 3 phones of different brands in Phase 5. |

## Maintainability

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-60 | Maintainability | Code shall be strictly typed and consistently formatted. | TypeScript `strict` on in every package; no `any` without a justifying comment; ESLint and Prettier pass with 0 errors in CI. | CI lint and type-check jobs. |
| NFR-61 | Maintainability | Types and validation shall have one source of truth. | Supabase-generated types and shared zod schemas live only in `packages/types` and are imported by web, mobile and Edge Functions; regenerated after every migration. | CI check that generated types match the database (`supabase gen types` diff is empty). |
| NFR-62 | Maintainability | Critical logic shall be covered by automated tests. | ≥ 80% line coverage for status computation, DTR computation and scan validation; every `record-attendance` error code has a Deno test; RLS has pgTAP tests per role. | Coverage reports in CI. |
| NFR-63 | Maintainability | The database shall be reproducible from migrations. | `supabase db reset` builds the full schema, RLS, functions, cron jobs and seed data from timestamped migrations with 0 manual steps. | CI job running `supabase db reset` and the pgTAP suite. |
| NFR-64 | Maintainability | Visual design shall come from shared tokens. | Colors, radius and fonts defined once in `packages/design-tokens` and consumed by Tailwind, NativeWind, Paper and Tamagui; 0 hard-coded color hex values in components. | Lint rule or text search for hex colors in `apps/`. |
| NFR-65 | Maintainability | The system shall be documented. | README with setup and run steps; every Edge Function documents its input, output and error codes; admin manual, BHW quick guide and kiosk setup guide delivered. | Documentation review in Phase 6. |
| NFR-66 | Maintainability | Operational values shall be configurable without code changes. | All values in `app_settings` (section M of the decisions file) changeable from the Settings page and applied on the next request. | Functional test changing the geofence radius and cooldown. |
| NFR-67 | Maintainability | Dependencies shall be controlled. | Lockfile committed; exact versions for UI libraries; dependency updates reviewed at least monthly; no deprecated package with a known high-severity vulnerability. | `pnpm audit` in CI; monthly maintenance log. |

## Auditability

| ID | Category | Requirement | Measure / acceptance | Verification method |
| --- | --- | --- | --- | --- |
| NFR-68 | Auditability | Every change to audited tables shall be recorded. | 100% of inserts, updates and deletes on `attendance_records`, `profiles`, `devices`, `correction_requests`, `schedules`, `employee_schedules`, `stations`, `holidays` and `app_settings` produce exactly one `audit_logs` row with actor, action, table, record ID, old and new data, except updates that change only `stations.last_seen_at` and `stations.is_online` (heartbeat and offline-detection writes), which are excluded to avoid about 1,440 rows per station per day; offline transitions are recorded in `error_logs` instead (D-34). | pgTAP tests per table and operation, including a test that a heartbeat-only `stations` update writes no `audit_logs` row and a test that changing any other `stations` column writes exactly one. |
| NFR-69 | Auditability | Audit logs shall be tamper-resistant. | No role (including admin and the authenticated API) has UPDATE or DELETE rights on `audit_logs`; only the 5-year retention job (D-32) removes rows. | pgTAP privilege tests; SQL review of grants. |
| NFR-70 | Auditability | Every attendance record shall be traceable to its source. | 100% of records carry `method`, and every record except end-of-day `absent` rows carries `created_by`; QR records link to `time_in_scan_id` / `time_out_scan_id`; corrections link to their request. | SQL check for missing links on seed and load-test data. |
| NFR-71 | Auditability | Manual and exception actions shall carry a reason. | 100% of manual entries, device resets, registration rejections and correction rejections have a non-empty reason or remarks in both the record and the audit entry. | pgTAP tests that calls without a reason fail; SQL spot check. |
| NFR-72 | Auditability | Every scan attempt shall be logged. | 100% of `record-attendance` and `record-fallback-scan` calls, successful or failed, create a `scan_attempts` row with error code (with `employee_id` left empty when the caller could not be identified, as for `AUTH_REQUIRED`). | Deno tests for each error code asserting the inserted row. |
| NFR-73 | Auditability | Audit history shall be easy to review. | The Audit Log page returns the full history of one record within 3 s at the reference data volume; filtered audit export to CSV available to admins. | Timed Playwright test; manual export check. |

> **System Administrator note:** NFR-29 (72-hour NPC breach notification), NFR-30 (DPO and Privacy Impact Assessment), NFR-45 (availability) and NFR-49 (backups) become go-live checklist items in Phase 6.
>
> **Software Engineer note:** NFR-01, NFR-02, NFR-07 and NFR-62 define the performance checks and coverage targets required in the Phase 6 test plan.
