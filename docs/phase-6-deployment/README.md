> **Role speaking: System Analyst** (index for all roles)

# Phase 6 – Testing, Deployment & Documentation (Index)

**Project:** BHW QR Attendance System (replaces the originally proposed fingerprint biometric system)
**Client setting:** Barangay Kalawag II Health Workers (BHW) Office, Isulan, Sultan Kudarat, Philippines
**Timezone:** Asia/Manila for every date, time, report and scheduled job.

This folder holds the last phase: how the system was tested, how it is deployed and run, the user documentation for the barangay, and the final summary against the Study Recommendation.

## Documents

| # | Document | Role | What it contains |
| --- | --- | --- | --- |
| 01 | [Test Cases and UAT](./01-test-cases-and-uat.md) | System Analyst | Test case table for every core flow and failure (scans, statuses, corrections, DTR totals, kiosk offline, fallback, manual entry, reports) and the UAT form with a 5-point scale. |
| 02 | [Quality and Security](./02-quality-and-security.md) | Software Engineer | Test commands and coverage targets, OWASP-based security checklist, and performance checks (dashboard update < 2 s, scan response < 3 s). |
| 03 | [Deployment](./03-deployment.md) | Backend Developer, Frontend Developer, System Administrator | Production migrations, Edge Functions, secrets and cron; web deployment to Vercel; Android build with EAS Build and OTA updates with EAS Update; go-live checklist. |
| 04 | [Operations](./04-operations.md) | System Administrator | Admin account creation, monitoring, backups and restore, incident response, secret rotation and offboarding. |
| 05 | [Administrator Manual](./05-admin-manual.md) | System Analyst | Step-by-step guide to every admin page: approvals, employees, schedules, holidays, stations, records, corrections, fallback scan, DTR, reports, monitoring, settings, privacy duties and a troubleshooting table of every scan message. |
| 06 | [Kiosk Setup Guide](./06-kiosk-setup-guide.md) | Frontend Designer / Developer | Hardware, placement for good phone GPS, station coordinates, kiosk account, full-screen and locked Android/PC setup, power and screen settings, daily checks and troubleshooting. |
| 07 | [BHW Quick Guide](./07-bhw-quick-guide.md) | System Analyst | One-page bilingual (English / Filipino) guide for BHW staff: register, log in, scan, fix a failed scan, request a correction, My QR, DTR, privacy and contact. Print and post near the kiosk. |
| 08 | [Final Summary](./08-final-summary.md) | All roles | Original problem → feature → acceptance criteria result, and the Study Recommendation compliance table with status and where each item is implemented. |

## Who reads what

| Reader | Start with |
| --- | --- |
| BHW staff | [07 – BHW Quick Guide](./07-bhw-quick-guide.md) |
| BHW office administrator | [05 – Administrator Manual](./05-admin-manual.md), then [06 – Kiosk Setup Guide](./06-kiosk-setup-guide.md) |
| System Administrator (IT) | [03 – Deployment](./03-deployment.md), [04 – Operations](./04-operations.md) |
| Developers and testers | [01 – Test Cases and UAT](./01-test-cases-and-uat.md), [02 – Quality and Security](./02-quality-and-security.md) |
| Panel / barangay management | [08 – Final Summary](./08-final-summary.md) |

## Values to fill in before go-live

The user documents use these operator-supplied values in angle brackets. The System Administrator replaces them before printing or sharing:

| Placeholder | Meaning | Used in |
| --- | --- | --- |
| `<portal-address>` | The barangay's web portal address; the same value as `<web-domain>` in [03 – Deployment](./03-deployment.md) | 05, 06, 07 |
| `<app-download-link>` | Where BHWs download the Android app | 07 |
| `<admin-name>`, `<office-phone>` | BHW office administrator's name and phone number | 07 |
| `<office-email-domain>` | E-mail domain for kiosk accounts | 06 |
