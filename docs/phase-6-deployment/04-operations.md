# 04 – Operations (System Administrator)

> **Role speaking: System Administrator.** Deployment commands are in [03-deployment.md](03-deployment.md). The access matrix, backup plan, HMAC rotation procedure and retention schedule are in [Phase 2 – 04 Operations and security](../phase-2-architecture/04-operations-and-security.md); this document is the day-to-day runbook built on them.

Owners: **SA** System Administrator · **BD** Backend Developer · **FD** Frontend Developer · **SE** Software Engineer · **AD** barangay admin (BHW office) · **DPO** Data Protection Officer.

Values in angle brackets (`<your-project-ref>`, `<web-domain>`, …) are operator-supplied. Keep an **ops log** (one shared document or spreadsheet) with date, person, action and result for every item marked "log".

---

## 1. Go-live checklist

Work top to bottom; do not start a section before the previous one is complete. Tick, initial and date each line.

**A. Accounts and access (T−14 days)**

- [ ] SA – Barangay-owned accounts exist (not personal): Supabase organisation, Vercel team, Expo organisation, GitHub organisation, Google Play developer account, Resend, Bitwarden organisation with collection **BHW prod**. At least two people have owner access to each.
- [ ] SA – Domain `<web-domain>` reserved; access to its DNS confirmed.
- [ ] DPO – DPO name, e-mail and phone filled in `DPO_CONTACT` (`apps/web/components/auth/privacy-notice.tsx`) and in the `[name]`, `[e-mail]`, `[phone]` / `[pangalan]`, `[telepono]` brackets of `apps/mobile/components/profile/privacy-notice.ts`; change merged to `main`.
- [ ] SE – Repository on GitHub, CI green on `main`, branch protection on (03-deployment §3).

**B. Backend (T−10 days)**

- [ ] BD – Production project created in **Singapore**, database password in Bitwarden (03-deployment §1.1).
- [ ] BD – CLI linked; `supabase\.temp\project-ref` shows the production ref (§1.2).
- [ ] BD – `supabase db push` applied 10 migrations, **no seed** (§1.3).
- [ ] SA – Station coordinates measured at the office (§3 below).
- [ ] BD + SA – `scripts/bootstrap-production.sql` run: Vault key, station, schedule, 2026 holidays; key backed up in Bitwarden (§1.4).
- [ ] BD – Vault secrets `project_url` and `service_role_key` created (§1.4 b).
- [ ] BD – Fresh Edge Function secrets generated, saved in Bitwarden, uploaded; local file deleted (§1.5).
- [ ] BD – 11 Edge Functions deployed and `ACTIVE` (§1.6).
- [ ] BD – 6 cron jobs active and `bhw-offline-kiosks` succeeding every minute (§1.7).
- [ ] BD – Staging smoke tests 22/22 and 14/14 pass; RLS SQL check shows 0 tables without RLS; buckets private; anonymous `profiles` read returns 0 rows (§1.8).
- [ ] BD – Auth: confirm e-mail ON, custom SMTP via Resend, redirect URLs, bilingual templates, rate limit (§1.9).

**C. Web and kiosk (T−7 days)**

- [ ] FD – Vercel project: root `apps/web`, install/build commands, Node 24, env vars incl. server-only `SUPABASE_SERVICE_ROLE_KEY`, region `sin1` (§2.1).
- [ ] FD – Custom domain live with HTTPS; Supabase Site URL/redirects, `APP_URL`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_APP_URL` updated and redeployed.
- [ ] SA – First admin account created and password changed (§2 below); log.
- [ ] AD – Admin → Settings reviewed (geofence 100 m, GPS accuracy 50 m, cooldown 5 min, office name and address).
- [ ] AD – Kiosk account created (Add staff account → Kiosk), linked to the station; viewer account(s) created if the Punong Barangay or secretary will use the read-only dashboard.
- [ ] FD + SA – Kiosk tablet set up and **Online** in Device Health (06-kiosk-setup-guide.md).
- [ ] SA – Uptime monitor on `https://<web-domain>/` active (§4).

**D. Mobile and UAT (T−7 to T−2 days)**

- [ ] FD – `eas init`, EAS env vars, `expo-updates` + `eas update:configure`, version `1.0.0` (§2.3).
- [ ] FD – Preview APK built and installed on the UAT phones; Android keystore backed up in Bitwarden.
- [ ] AD + SA – UAT run with the Phase 6 test cases and UAT form; every blocking issue fixed and retested; sign-off sheet signed.
- [ ] FD – Production AAB uploaded to Play **Internal testing**; tester list = all BHWs (§2.4).
- [ ] BD + AD – Per-role production checklist complete (03-deployment §1.8, step 4); log.

**E. Go-live day (T0)**

- [ ] AD – Orientation for BHWs using the one-page quick guide: install from the Play link, register on the web, confirm e-mail.
- [ ] AD – Approve registrations in Admin → Approvals the same day; assign the regular schedule.
- [ ] AD – Each BHW binds the phone and does one supervised test scan at the kiosk (time-in appears on the dashboard within 2 s).
- [ ] SA – Watch Device Health and Error Logs during the first morning and afternoon peaks (07:30–08:30, 16:45–17:30).
- [ ] AD – Paper logbook kept in parallel for the first 2 weeks as a fallback and for reconciliation.

**F. After go-live**

- [ ] SA – T+1: check `bhw-end-of-day` ran at 04:05 and absent/incomplete records look right.
- [ ] AD – T+7: compare the weekly report with the paper logbook; differences explained or corrected through correction requests.
- [ ] SA – First Monday 06:00: weekly verification report received (§4).
- [ ] SA – T+14: first restore drill scheduled (§5); paper logbook retired if T+7 reconciliation was clean.
- [ ] FD – Promote the Play release from internal testing to production when the office decides to (optional; internal testing is sufficient for ≤ 100 staff).

---

## 2. Creating the first admin account

**How roles are assigned.** The database trigger `handle_new_user()` (migration `20261101000100_helpers.sql`) runs for every new row in `auth.users`. It reads **`raw_app_meta_data ->> 'role'`** (the user's *app_metadata*, which only the service role can set):

- `admin`, `kiosk` or `viewer` → creates an **active** profile with that role. No BHW ID or consent needed.
- anything else (including no role) → treats the user as a BHW self-registration: it requires `consent = true`, a BHW ID, area, contact number and address in *user_metadata*, otherwise it raises `CONSENT_REQUIRED`.

That is why the dashboard's **Authentication → Users → Add user → Create new user** form cannot create the first admin: it has no app_metadata field, so the trigger rejects the user and the dashboard shows "Database error creating new user". Use one of the two methods below. After the first admin exists, every other staff account (more admins, kiosks, viewers) is created in the web portal with **Admin → Employees → Add staff account**, which sets app_metadata the same way.

### Method A (recommended) – Auth Admin API from PowerShell

This is the Supabase "add user" call with `app_metadata.role = admin`, done through the API.

1. Generate a temporary password (16+ characters) in Bitwarden and save it as `BHW prod – first admin (temporary)`.
2. In Windows PowerShell (the two `Read-Host` prompts keep the key and password out of the command history):

   ```powershell
   $ref = "<your-project-ref>"
   $serviceKey = Read-Host "Paste the service_role key"
   $tempPassword = Read-Host "Paste the temporary admin password"
   $body = @{
     email         = "<admin-email>"
     password      = $tempPassword
     email_confirm = $true
     app_metadata  = @{ role = "admin" }
     user_metadata = @{ full_name = "<Admin Full Name>" }
   } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri "https://$ref.supabase.co/auth/v1/admin/users" -Headers @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" } -ContentType "application/json" -Body $body
   Remove-Variable serviceKey, tempPassword
   ```

   The response shows the new user with `"app_metadata": { … "role": "admin" }`.
3. Check in the SQL editor:

   ```sql
   select id, full_name, email, role, status from public.profiles where role = 'admin';
   -- expected: 1 row, status = active
   ```

4. The admin signs in at `https://<web-domain>/login`, then signs out and uses **Forgot password?** to set a personal password (this also proves the Resend SMTP path works). Delete the temporary password from Bitwarden. Log the creation.

### Method B – bootstrap SQL

Fill in `bootstrap.admin_email`, `bootstrap.admin_full_name` and `bootstrap.admin_temp_password` in section 0.3 of [`scripts/bootstrap-production.sql`](../../scripts/bootstrap-production.sql) before running it. The optional block inserts the `auth.users` row (password hashed with `extensions.crypt` / bcrypt, `raw_app_meta_data.role = admin`) and the matching `auth.identities` row, exactly as `supabase/seed.sql` does. It skips itself if the e-mail already exists. Then do steps 3–4 of Method A. Do not save the edited script anywhere.

### Changing a staff account password (kiosk rotation, offboarding)

Staff with a mailbox use **Forgot password?** on `/login`. For the kiosk account (shared, often without a mailbox), set the new password with the Auth Admin API. Get the user's id from `select id, email from public.profiles where role = 'kiosk';`, save the new password in Bitwarden first, then:

```powershell
$ref = "<your-project-ref>"
$serviceKey = Read-Host "Paste the service_role key"
$newPassword = Read-Host "Paste the new kiosk password"
$body = @{ password = $newPassword } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "https://$ref.supabase.co/auth/v1/admin/users/<kiosk-user-id>" -Headers @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" } -ContentType "application/json" -Body $body
Remove-Variable serviceKey, newPassword
```

Then sign in again on the kiosk tablet with the new password.

---

## 3. Station coordinates at the BHW office

The geofence check compares the phone's GPS position at scan time with the station's latitude/longitude. Coordinates measured from a map are often 20–50 m off; measure on site.

1. Stand **exactly where the kiosk tablet will be mounted**, with the phone held at chest height, near (not behind) a window or door if the room is enclosed. Turn on Location → **Google Location Accuracy / High accuracy**, Wi-Fi on.
2. Take a reading with one of:
   - **Preferred:** sign in to `https://<web-domain>` as the admin on the phone's Chrome → Admin → Stations & Kiosks → edit the station → **Use my location**. The form shows the reading and its accuracy ("accuracy about N m").
   - Google Maps: wait for the blue dot to settle, long-press on it, copy the coordinates shown at the top (latitude, longitude).
3. Accept a reading only if the accuracy is **≤ 15 m**. Take **3 readings** about 1 minute apart (walk away a few steps and come back between readings).
4. Average them: latitude = (lat1 + lat2 + lat3) ÷ 3, longitude = (lng1 + lng2 + lng3) ÷ 3, rounded to **6 decimals** (≈ 0.1 m). If one reading differs from the others by more than ~20 m, discard it and take another.
5. Choose the **radius: 50–100 m**. Use 50–75 m if the office is in a dense area with houses all around (limits scanning from a neighbour's house); use 100 m (the default) if GPS indoors is weak. Do not go above 100 m without the barangay admin's written approval.
6. Enter the averaged values in `bootstrap-production.sql` section 0.2 (first time) or in Admin → Stations & Kiosks (later). Log the three readings, the average and the radius.
7. **Field test** during UAT with a BHW volunteer's bound phone and the live kiosk QR (only employee accounts can scan; a successful test scan is the volunteer's real time-in, failed ones are kept only in scan attempts):
   - at the kiosk → must succeed;
   - at the office **door** → must succeed;
   - on the **street** in front of the office → must succeed if within the radius (expected for 100 m), otherwise rejected;
   - about **150 m** away (or beyond the radius) with a photo of the QR → must be rejected with `OUTSIDE_GEOFENCE`.
   Note the results in the ops log. If the door test fails, re-measure; if it still fails, raise the radius in 10 m steps (max 100 m).

---

## 4. Monitoring

| What | Where | How often | Who | Alert threshold / action |
| --- | --- | --- | --- | --- |
| Kiosk status | Admin → **Device Health** (online, last heartbeat, app version, clock drift, last token) | Every working morning 07:30, plus the bell notification | AD | Offline > 3 min → runbook 6.1. Drift > 30 s → reload kiosk, check tablet time sync |
| Errors | Admin → **Error Logs** (Edge Function, kiosk, mobile; severity) | Daily; immediately on a **critical** | SA | Any `critical` → investigate the same day. > 20 failed scans per hour → runbooks 6.2/6.3 |
| Failed scans | Error Logs + SQL below | Weekly | SA | Rising `OUTSIDE_GEOFENCE` / `GPS_INACCURATE` → 6.3; `QR_REUSED` / `DEVICE_MISMATCH` clusters → 6.4 |
| Weekly verification report | Bell notification "Weekly verification report" every **Monday 06:00** (also in Error Logs, severity info) | Weekly | AD | No phone > 0 → remind BHW to bind; No schedule > 0 → assign; Stale pending > 0 → approve or reject; No scans in 60 days → confirm status |
| Supabase usage | Dashboard → **Reports** / **Usage**: database size, egress, Edge Function invocations, Realtime connections, Auth MAU | Monthly | SA | > 70 % of any plan quota → review retention or upgrade |
| Supabase advisors | Dashboard → **Advisors** (Security, Performance) | Monthly and after each migration | BD | Fix every *Security* error |
| Cron health | `cron.job_run_details` (03-deployment §1.7) | Weekly | SA | Any job `failed` → read `return_message`, fix, log |
| Uptime | External monitor (e.g. UptimeRobot free) on `https://<web-domain>/` (the landing page – public, no login), HTTP 200, every 5 min, e-mail + SMS to SA | Continuous | SA | 2 consecutive failures → check Vercel status and deployments; roll back if a deploy caused it |
| Supabase / Vercel status | <https://status.supabase.com>, <https://www.vercel-status.com> (subscribe by e-mail) | On alert | SA | Platform incident → inform AD, use fallback (6.1) |
| Backups | Dashboard → Database → Backups | Weekly | SA | Missing daily backup → contact Supabase support |

Failed scans in the last 7 days by reason:

```sql
select error_code, count(*) as n
from public.scan_attempts
where not success and created_at > now() - interval '7 days'
group by error_code order by n desc;
```

---

## 5. Backups

The plan (methods, retention, RPO 24 h / RTO 4 h, restore procedure) is in [Phase 2 – 04 §2 Backup and restore plan](../phase-2-architecture/04-operations-and-security.md#2-backup-and-restore-plan).

- **Pro plan:** daily backups and 7-day Point-in-Time Recovery are automatic (Database → Backups). Confirm PITR is enabled at go-live.
- **Independent copy:** `.github/workflows/backup.yml` dumps roles, schema and data every night at 01:00 Manila, encrypts the archive with the barangay's `age` public key and keeps it 30 days as a workflow artifact. Set the repository secrets `SUPABASE_DB_URL` (production Session pooler string) and `BACKUP_AGE_RECIPIENT` (age public key; the private key stays offline with the SA), run it once with *Run workflow*, and download one copy a month to offline storage (12 monthly copies). If GitHub Actions is unavailable, the SA makes the same dump by hand from a PC with the CLI linked to production (it asks for the database password):

  ```powershell
  New-Item -ItemType Directory -Force backups | Out-Null
  $d = Get-Date -Format yyyy-MM-dd
  pnpm supabase db dump --linked -f "backups\$d-schema.sql"
  pnpm supabase db dump --linked --data-only -f "backups\$d-data.sql"
  ```

  Move both files to the encrypted barangay drive or external disk the same day and delete them from the PC (`backups\` holds personal data; never commit it). Keep 30 daily/weekly + 12 monthly copies.
- **Secrets are part of the backup:** a dump restored into a **new** project cannot decrypt Vault secrets. Restoring requires the Bitwarden copies of `profile_encryption_key`, the Edge Function secrets and the database password.
- **Restore drill:** the **first drill is due 30 days after go-live** (write the date on the go-live checklist, section F), then every quarter. Follow the Phase 2 drill steps: restore the latest dump into a fresh staging project, re-create the Vault key from Bitwarden, run `pnpm db:test:remote` against it, compare last month's `get_monthly_summary` totals with production, and log the time taken (target ≤ 4 h).

---

## 6. Incident response runbook

For every incident: note start time, who was told, what was done and when it was resolved in the ops log. Severity: **P1** nobody can record attendance or personal data exposed; **P2** some BHWs affected; **P3** cosmetic or single user.

### 6.1 Kiosk offline (P2)

Signs: Device Health shows **Offline**, bell notification "Kiosk offline", critical error "Kiosk offline: … missed 3 heartbeats".

1. Look at the tablet: powered? screen on? kiosk page open (not the home screen or a Chrome error)? Wi-Fi connected?
2. Reload the page. If it shows the login page, sign in again with the kiosk account (password in Bitwarden).
3. No internet: switch to mobile data / hotspot; restart the router.
4. Check the tablet clock is automatic (Settings → Date & time → Automatic). The server uses its own time, but a wrong clock can break HTTPS.
5. Still offline after 10 minutes: use the **fallback** so attendance continues – BHWs open **My QR** in the app and the admin scans it at Admin → **Fallback scan**; if that is not possible, Admin → Attendance → **manual entry** with a reason (both are audited).
6. Platform outage (status pages red): inform BHWs to use the paper logbook; enter the records afterwards as manual entries with the reason "System outage <date>".

### 6.2 QR not scanning (P2/P3)

1. One BHW only: read the message on the phone or the newest Error Logs row for that user.
   - `DEVICE_MISMATCH` / `DEVICE_NOT_BOUND` → the phone was changed or reinstalled; verify identity, then Admin → Employees → **Reset device**; the BHW logs in again to bind.
   - `QR_EXPIRED` → slow network or a photo/screenshot of the QR; scan the live screen again.
   - `COOLDOWN_ACTIVE` / `ALREADY_COMPLETED` → expected behaviour; explain.
   - Camera does not focus → clean the lens, hold 20–30 cm away, increase kiosk brightness.
2. All BHWs: check the kiosk (6.1). Then `QR_INVALID` for everyone right after a secret rotation → the kiosk is showing an old token; reload the kiosk. If it persists, confirm `QR_SIGNING_SECRET` and `QR_SIGNING_SECRET_PREVIOUS` are set as in the rotation procedure and redeploy the functions (03-deployment §1.6).
3. Edge Functions failing (5xx in Error Logs) → Supabase Dashboard → Edge Functions → Logs; redeploy; escalate to BD.

### 6.3 Mass GPS failures (P2)

Signs: many `OUTSIDE_GEOFENCE` or `GPS_INACCURATE` in the failed-scan query (§4).

1. Kiosk moved? Re-measure the station (§3).
2. `GPS_INACCURATE` for most BHWs (cloudy weather, indoors): ask BHWs to step near the door and wait until the health check shows accuracy ≤ 50 m. If it continues for a full shift, the admin may raise **Settings → Worst GPS accuracy accepted** from 50 to at most 75 m for that period; log the change and revert it the next day.
3. `OUTSIDE_GEOFENCE` with distances just above the radius: re-measure before increasing the radius; maximum 100 m.
4. Meanwhile use the fallback personal QR scan (6.1 step 5).

### 6.4 Suspected attendance fraud (P2)

Signs: anomaly flags in Error Logs (`scan_anomaly`), repeated `QR_REUSED` or `DEVICE_MISMATCH` for the same people, one phone binding attempts for several accounts, scans at odd hours, a supervisor's report of buddy punching.

1. **Preserve evidence first.** Do not delete or edit records. Export Admin → Audit Log and the relevant Error Logs / attendance to CSV, plus:

   ```sql
   select created_at at time zone 'Asia/Manila' as manila_time, employee_id, station_id, success,
          error_code, round(lat::numeric, 5) lat, round(lng::numeric, 5) lng, accuracy
   from public.scan_attempts
   where employee_id = '<employee-uuid>' and created_at > now() - interval '30 days'
   order by created_at;
   ```

2. Reset the device of the accounts involved (Admin → Employees → Reset device, reason ≥ 10 characters) so the next binding is supervised.
3. Report to the barangay admin / Punong Barangay; the BHW is heard before any decision (due process). The system only provides evidence.
4. Wrong records are fixed only through Admin → Attendance manual entry or an approved correction, each with a reason (audited). Log the case.

### 6.5 Personal data breach (P1) – NPC notification within 72 hours

A breach is any unauthorised access, disclosure, loss or alteration of personal data (for example a leaked service_role key, a lost unlocked admin laptop, an exported report sent to the wrong group chat). RA 10173 and **NPC Circular 16-03** require notifying the **National Privacy Commission and the affected data subjects within 72 hours of discovery** when sensitive personal information or information that could enable identity fraud is involved and there is a real risk of serious harm. When in doubt, notify.

| When | Step | Owner |
| --- | --- | --- |
| Hour 0 | Record date/time of discovery. Inform the DPO and the Punong Barangay. | Whoever discovers it → SA |
| Hour 0–4 | **Contain:** rotate the leaked secret (§7, 6.6); deactivate compromised accounts; block their sessions (ban the user, see the note below this table, or rotate the JWT secret to sign everyone out); remove a wrongly shared file; if needed take the portal offline by removing the custom domain from the Vercel project. | SA + BD |
| Hour 4–24 | **Assess:** what data (names, BHW IDs, e-mails, contact numbers, addresses, photos, GPS points, attendance), how many people, since when, how (Audit Log, Supabase Auth and API logs, Vercel logs). Preserve logs (export). | SA + DPO |
| Hour 24–48 | Decide with the DPO whether notification is mandatory; prepare the notices. | DPO |
| **≤ 72 h** | Notify the NPC through its breach notification system (privacy.gov.ph) and each affected BHW (e-mail plus in person). | DPO |
| ≤ 5 days | Full report to the NPC if it asks; fix the root cause; retest (03-deployment §1.8). | DPO + SA |
| Yearly | Include the incident in the annual security incident report to the NPC. | DPO |

**Blocking a user's sessions immediately.** Deactivating the profile already stops every RLS-protected read and every scan. To also stop the user from refreshing tokens, ban the auth user with the Admin API (same PowerShell pattern as §2, body `@{ ban_duration = "876000h" } | ConvertTo-Json`, method `Put`, URI `https://$ref.supabase.co/auth/v1/admin/users/<user-id>`); lift the ban later with `ban_duration = "none"`. Access tokens already issued expire within 1 hour (JWT expiry 3600 s).

Notification template (NPC and data subjects – fill every `<…>`):

```text
Subject: Personal data breach notification – Barangay Kalawag II BHW Attendance System

1. Personal information controller: Barangay Kalawag II, Isulan, Sultan Kudarat – BHW Office.
   Data Protection Officer: <DPO name>, <DPO e-mail>, <DPO phone>.
2. Date and time of discovery: <yyyy-mm-dd hh:mm>. Date/period of the breach: <…>.
3. Nature of the breach: <what happened, how it was discovered>.
4. Personal data involved: <e.g. names, BHW ID numbers, e-mail addresses, contact numbers, addresses, attendance times>.
   Sensitive personal information involved: <yes/no – which>.
5. Number of data subjects affected: <n>.
6. Likely consequences: <…>.
7. Measures taken to contain and reduce harm: <keys rotated at …, accounts disabled at …>.
8. Measures data subjects can take: <e.g. change your password, watch for phishing using your contact number>.
9. Contact for questions: <DPO contact>.
```

### 6.6 Secret leak (P1)

Any secret seen outside Bitwarden or the platform (pasted in chat, committed to git, in a screenshot) is treated as leaked.

| Leaked | Do immediately |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` / JWT secret | Supabase → Project Settings → JWT Keys / API Keys → rotate. Update Vercel `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if the anon key changed) → Redeploy; `vault.update_secret` for `service_role_key` (03-deployment §1.4); if the anon key changed, update the EAS env var and publish `eas update --channel production --environment production`. Treat as a breach (6.5) until logs show no misuse. |
| `QR_SIGNING_SECRET` / `PERSONAL_QR_SIGNING_SECRET` | Rotate now with the PREVIOUS-key procedure (Phase 2 §3), then clear the previous key after 60 s instead of waiting for the schedule. |
| `DEVICE_HASH_PEPPER` | Set a new value; every phone is un-bound. Announce to BHWs, then each re-binds on next login (supervised). |
| `DEVICE_SYNC_API_KEY` | Set a new value (or remove it to disable the endpoint). |
| `RESEND_API_KEY` | Revoke in Resend, create a new key, update Supabase SMTP password and the Edge Function secret. |
| Database password | Project Settings → Database → **Reset database password**; update Bitwarden and any `supabase\.env.test.local`. |
| `profile_encryption_key` | Treat as a breach (6.5): the key plus a database copy reveals contact numbers and addresses. Re-key at once: create the new key with `select vault.create_secret('<new 32-byte base64>', 'profile_encryption_key_next');` then `select public.rotate_profile_encryption_key('profile_encryption_key_next');` — one transaction re-encrypts every contact number and address and makes the new key current (migration `20261101001000`). Store the new key in Bitwarden. |
| Kiosk / admin password | Change it (§2) and ban the user until the new password is in place (note below the 6.5 table); deactivated profiles are blocked by RLS in any case. |
| Android upload keystore | Play Console → App integrity → request an **upload key reset**. |

Secrets committed to git stay in the history: rotate them; removing the commit is not enough.

---

## 7. Secret rotation schedule

| Secret | Stored in | Rotate | How | Effect on users |
| --- | --- | --- | --- | --- |
| `QR_SIGNING_SECRET` | Edge Function secrets + Bitwarden | Every **90 days** | Phase 2 §3 (set new + `_PREVIOUS`, clear after 60 s) | None |
| `PERSONAL_QR_SIGNING_SECRET` | Edge Function secrets + Bitwarden | Every **90 days** (same day) | Phase 2 §3 | None |
| Kiosk account password | Bitwarden | Every **90 days** and on staff offboarding | §2 "Changing a staff account password"; sign in again on the tablet | Kiosk re-login (1 min) |
| Database password | Bitwarden | Every **12 months** and on offboarding | Project Settings → Database → Reset password | None |
| `RESEND_API_KEY` | Edge Function secrets, Supabase SMTP, Bitwarden | Every **12 months** | New key in Resend → update SMTP + secret → revoke old | None |
| `DEVICE_SYNC_API_KEY` | Edge Function secrets + terminal | Every **12 months** (when a terminal exists) | Set new value, update the terminal | Terminal reconfigured |
| Supabase `service_role` / JWT keys | Vercel, Vault `service_role_key`, Bitwarden | Only on leak or offboarding of someone who had it | 6.6 | Possible sign-out of all users |
| `DEVICE_HASH_PEPPER` | Edge Function secrets + Bitwarden | **Never routinely** – only after a confirmed leak | 6.6 | Every phone re-binds |
| `profile_encryption_key` | Vault + Bitwarden | **Never routinely** | Re-encryption migration (6.6) | None |
| Android upload keystore | EAS + Bitwarden | Never (reset only if lost/leaked) | Play Console upload key reset | None |
| Personal admin / viewer passwords | Each user | On suspicion; offboarding | Forgot password / admin deactivation | – |

Put the next due dates in the ops log on the day of go-live (90-day items: go-live + 90 days).

---

## 8. Staff offboarding

**A BHW leaves (resigns, ends term, transferred)**

1. Make sure the last day's attendance and pending corrections are complete; print/export the final DTR.
2. Admin → Employees → open the BHW → **Deactivate** with a reason (≥ 10 characters). The app shows "Account deactivated" and the web portal signs them out; they can no longer scan.
3. **Reset device** (reason "Offboarding <date>") so the phone binding is released.
4. Attendance, corrections and audit records stay for 5 years (retention); personal fields are erased on request (§9) or 5 years after deactivation.
5. Ask the BHW to uninstall the app; remove them from the Play internal testing list.

**An admin, viewer or the System Administrator leaves**

1. Another admin deactivates their account (Admin → Employees → Staff accounts → Deactivate; admins cannot deactivate themselves).
2. Remove them from: Supabase organisation, Vercel team, Expo organisation, GitHub organisation, Google Play Console users, Resend, Bitwarden organisation, the domain/DNS account.
3. **Rotate every shared secret they could see:** kiosk password, database password, Resend key; the service_role key if they had dashboard or Vercel access (6.6 table). Rotate the QR signing secrets early.
4. Log the offboarding with the list of what was rotated.

**A kiosk tablet is retired, lost or replaced**

1. Admin → Stations & Kiosks → edit the station → unlink the kiosk account.
2. Deactivate that kiosk account (Employees → Staff accounts) – or, for a replacement tablet, keep the account but **change its password** (§2) and sign in on the new tablet.
3. Lost/stolen tablet: also ban the kiosk user at once (6.5 note) so the lost tablet's session cannot refresh, change the kiosk password, and lift the ban when the replacement tablet is ready to sign in; if the tablet had a saved admin login, treat it as a possible breach (6.5).
4. Factory-reset a retired tablet before it leaves the office.

---

## 9. Data subject requests (RA 10173)

Requests come to the DPO (contact in the privacy notice). Verify the requester's identity in person or from their registered e-mail. Answer within **15 days** (as promised in the privacy notice) and log each request.

| Request | How to fulfil |
| --- | --- |
| **Access** – "what do you have about me?" | Admin → Employees → the BHW: profile (name, BHW ID, area, e-mail, contact number and address are decrypted for admins), bound phone model, schedule. Export their attendance (Admin → Attendance filtered by employee → CSV), DTRs (Admin → DTR → PDF) and correction requests. Hand over in person or by e-mail to the registered address. Device IDs are stored only as hashes; no biometric data or fingerprints are stored. |
| **Correction** | Profile fields: the BHW edits contact number, address and photo in the app/web; other fields the admin edits. Attendance: the BHW files a correction request, the admin approves with remarks (audited). |
| **Erasure / withdrawal of consent** | The BHW can no longer use the QR system (attendance is then entered manually by the admin). Deactivate the account (§8), then erase the optional personal fields – attendance, DTR and audit records are kept for 5 years for Civil Service/COA purposes (legal obligation): |

```sql
-- Run in the SQL editor after the account is deactivated. The change is audited (values redacted).
update public.profiles
set contact_number_enc = null, address_enc = null, photo_url = null
where id = '<employee-uuid>' and status = 'inactive';
```

Then delete the BHW's folder in Storage → `profile-photos` → `<employee-uuid>/` and in `selfies` → `<employee-uuid>/` if any.

| Request | How to fulfil |
| --- | --- |
| **Object / complaint** | Record it; the DPO answers in writing. The BHW may complain to the National Privacy Commission (privacy.gov.ph). |
| **Data portability** | Provide the CSV exports from the Access row. |
