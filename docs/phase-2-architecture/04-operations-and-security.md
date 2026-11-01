# 04 – Access Matrix, Backups, Secret Rotation, Retention

> **Role speaking: System Administrator** (Software Engineer notes inline)

## 1. Roles × modules access matrix

Legend: **F** full (create/read/update), **R** read, **O** own rows only, **—** no access. Enforced by RLS, RPC guards, Edge Function guards and the web proxy (BR-17, BR-18). Detailed per-capability table: `docs/phase-1-system-analysis/05-business-rules.md` §3.1.

| Module | admin | employee | kiosk | viewer |
| --- | --- | --- | --- | --- |
| Registration (`/register`) | — (creates staff accounts in Employees) | O (self, becomes pending) | — | — |
| Employee information management | F | O (read; edit contact, address, photo) | — | — |
| Approval (pending registrations) | F | — | — | — |
| Device binding / reset | F (reset, history) | O (bind own phone) | — | — |
| Kiosk QR issue | R (can open any kiosk page) | — | F (own station only) | — |
| Scan attendance (`record-attendance`) | — | O (when active) | — | — |
| Fallback scan / manual entry | F | O (show personal QR) | — | — |
| Attendance records | R (writes only via RPCs) | O (read) | R (own station live feed: first name + time) | R (via report RPCs; no GPS) |
| Correction requests | F (review) | O (file, cancel pending) | — | — |
| DTR | F (single + batch) | O (own) | — | R |
| Reports (daily/weekly/monthly, export) | F | — | — | R |
| Dashboard | F | — | — | R (read-only dashboard) |
| Schedules, holidays | F | O (read own schedule) | — | — |
| Stations & device health | F | — | O (heartbeat) | R (status only) |
| Device sync (fingerprint terminal) | F (configure) | — | — | — |
| Error logs | F (read, resolve) | O (write via `log-error`) | O (write via `log-error`) | — |
| Audit log | R (append-only, nobody updates or deletes) | — | — | — |
| Settings (`app_settings`) | F | — | — | — |
| Notifications | O | O | — | — |

## 2. Backup and restore plan

| Item | Method | Frequency | Retention | Owner |
| --- | --- | --- | --- | --- |
| Database (Pro plan) | Supabase daily backups + Point-in-Time Recovery (7 days) | Continuous | 7 days PITR, daily for 7 days | System Administrator |
| Database (any plan, independent copy) | `supabase db dump --data-only` + schema dump from a scheduled GitHub Action, encrypted with `age` and stored in the barangay Google Drive / external disk | Nightly 01:00 Manila | 30 daily + 12 monthly | System Administrator |
| Storage objects | `supabase storage` download script (`profile-photos`, `correction-attachments`; selfies excluded — 30-day data) | Weekly | 8 weekly | System Administrator |
| Secrets | Barangay password manager (Bitwarden org) | On every change | Latest + previous | System Administrator |
| Code | GitHub (`main`, tags) | Every merge | Permanent | Software Engineer |

**Targets:** RPO 24 h (≤ 2 min with PITR), RTO 4 h (NFR-49).

**Restore drill (quarterly):** restore the latest nightly dump into a fresh staging project → `supabase db push` for any newer migrations → run `pnpm db:test` against it → compare `get_monthly_summary` totals of last month with production → record the result in the ops log.

**Restore procedure (production incident):** (1) put the web portal in maintenance (Vercel env `MAINTENANCE=1`, then redeploy; every page answers 503 with a bilingual notice — `apps/web/proxy.ts`), (2) PITR to the timestamp before the incident from the Supabase dashboard, or restore the encrypted dump with `psql`, (3) re-set Vault secret and Edge Function secrets if the project was recreated, (4) verify RLS with the Phase 6 per-role checks, (5) re-open, (6) log the incident (NFR-29 breach assessment if personal data was exposed).

## 3. HMAC secret rotation (D-11)

Secrets: `QR_SIGNING_SECRET`, `PERSONAL_QR_SIGNING_SECRET`. Rotate every 90 days, and immediately if a leak is suspected.

1. Generate a new 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. `supabase secrets set QR_SIGNING_SECRET_PREVIOUS=<current> QR_SIGNING_SECRET=<new>` (same for personal QR).
3. Edge Functions verify against both keys; new tokens are signed with the new key immediately. Kiosks pick up new tokens within 15 s.
4. After at least 60 s (two token lifetimes), clear the previous key: `supabase secrets set QR_SIGNING_SECRET_PREVIOUS=`.
5. Record the rotation date in the ops log. No downtime; no app update needed.

`DEVICE_HASH_PEPPER` is **not** rotated routinely — changing it un-binds every phone. Rotate only after a confirmed leak, together with a bulk device reset announced to staff.

`profile_encryption_key` (Vault) rotation: create the new key as Vault secret `profile_encryption_key_next`, then run `select public.rotate_profile_encryption_key('profile_encryption_key_next');` (migration `20261101001000`). In one transaction it re-encrypts `contact_number_enc` / `address_enc`, writes the new key into `profile_encryption_key` and removes the temporary secret.

## 4. Retention schedule (D-32)

| Data | Retention | Mechanism |
| --- | --- | --- |
| `qr_nonces`, `qr_nonce_uses` | 1 day | pg_cron hourly cleanup |
| Selfie files (`selfies` bucket) and `scan_attempts.selfie_path` | 30 days | pg_cron daily retention job (Storage API delete via Edge Function) |
| `kiosk_heartbeats` | 30 days | pg_cron daily |
| `error_logs` | 180 days | pg_cron daily |
| `scan_attempts` | 1 year | pg_cron daily |
| `notifications` | 1 year | pg_cron daily |
| `attendance_records`, `correction_requests` (+ attachments), `audit_logs` | 5 years | pg_cron monthly; attachments deleted with their request |
| Rejected registrations (profile, auth user, photo) | 90 days after rejection | pg_cron daily |
| Former employees (`inactive`) | Personal fields (contact, address, photo) erased on request or 5 years after deactivation; attendance kept 5 years for DTR/audit | Admin action + pg_cron |
| Backups | 30 daily + 12 monthly | Backup job |

> **Software Engineer note:** Every retention delete is itself written to `audit_logs` as one summary row per job run (count per table), not one row per deleted record.
