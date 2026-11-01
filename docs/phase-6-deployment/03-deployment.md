# 03 – Deployment

> **Roles speaking:** Backend Developer (§1), Frontend Developer (§2), Software Engineer (§3). Day-to-day operation after go-live is in [04-operations.md](04-operations.md).

Conventions used below:

- Commands are for **Windows PowerShell** run from the repository root (`C:\Users\<you>\Documents\BhwQr`) unless a step says otherwise. Where Command Prompt (Cmd) differs, the Cmd form is given too.
- Values in angle brackets are **operator-supplied** and must be replaced, for example `<your-project-ref>` (the 20-letter ID in `https://<your-project-ref>.supabase.co`), `<web-domain>` (for example `bhw.kalawag2.gov.ph`), `<anon-key>`.
- The Supabase CLI is a dev dependency of the repo, so it runs as `pnpm supabase …` (no global install).
- Secrets never go into git, chat, screenshots or tickets. Every secret created here is saved first in the barangay password manager (Bitwarden organisation, collection **BHW prod**).

| Environment | Supabase project | Region | Data | Web | Mobile build profile |
| --- | --- | --- | --- | --- | --- |
| Local | `supabase start` (Docker) | – | `seed.sql` demo data | `pnpm dev:web` | Expo Go / `development` |
| Staging | `zzspfykdcjsvpjriomwf` (current dev project) or a new staging project | eu-west-1 (dev) | `seed.sql` demo data | Vercel Preview | `preview` (APK) |
| Production | **new project** `bhw-qr-attendance-prod` | **ap-southeast-1 (Singapore)** | real data only, created by `scripts/bootstrap-production.sql` | Vercel Production `https://<web-domain>` | `production` (AAB) |

---

## 1. Backend Developer – Supabase production

### 1.1 Create the production project

1. Sign in at <https://supabase.com/dashboard> with the barangay organisation account (not a personal account).
2. **New project** → Organisation: the barangay org → Name: `bhw-qr-attendance-prod` → Database password: click **Generate a password**, save it in Bitwarden as `BHW prod – database password` → Region: **Southeast Asia (Singapore)** (`ap-southeast-1`) → Plan: **Pro** (daily backups + PITR, see [Phase 2 backup plan](../phase-2-architecture/04-operations-and-security.md#2-backup-and-restore-plan)) → **Create new project**.
3. Wait until the project status is **Healthy**. Copy the project ref from **Project Settings → General → Project ID**.
4. **Project Settings → API Keys**: note where the anon (publishable) key and the service_role (secret) key are. This system uses the **legacy JWT keys** (`anon`, `service_role`, both start with `eyJ`), the same as the dev project and the scripts in `scripts/`.

### 1.2 Link the CLI

```powershell
pnpm install --frozen-lockfile
pnpm supabase login
pnpm supabase link --project-ref <your-project-ref>
```

`link` asks for the database password (paste it from Bitwarden). It writes the ref to `supabase\.temp\project-ref` (git-ignored). Every later `--linked` command and the smoke scripts use **this** file, so always check which project is linked before running anything:

```powershell
Get-Content supabase\.temp\project-ref
```

Cmd: `type supabase\.temp\project-ref`

### 1.3 Push the migrations (no seed)

```powershell
pnpm supabase db push --linked --dry-run
pnpm supabase db push --linked
```

- The dry run must list exactly the 10 migrations `20261101000000_schema.sql` … `20261101000900_settings_followups.sql`.
- **Never add `--include-seed`** on production. `supabase/seed.sql` creates demo accounts with the published password `BhwDemo#2026`.
- Confirm in **Database → Migrations** that all 10 versions are listed.

### 1.4 Vault secrets

Open **SQL Editor → New query**. Do not save these queries as snippets.

**a) `profile_encryption_key`** – created by the bootstrap script, which also inserts the first station, the default schedule and the 2026 holidays. Follow the instructions in section 0 of [`scripts/bootstrap-production.sql`](../../scripts/bootstrap-production.sql) (generate the key, save it in Bitwarden, paste it, enter the station coordinates measured as in [04-operations.md §3](04-operations.md#3-station-coordinates-at-the-bhw-office)), paste the whole file into the SQL editor and **Run**. If you need to create only the key by hand:

```sql
-- Run once. Generate the value with:
--   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
select vault.create_secret('<paste-generated-profile-encryption-key>', 'profile_encryption_key',
  'pgcrypto key for profiles.contact_number_enc / address_enc (D-29)')
where not exists (select 1 from vault.secrets where name = 'profile_encryption_key');
```

**b) `project_url` and `service_role_key`** – used by the `bhw-storage-cleanup` cron job to call the `storage-cleanup` Edge Function through `pg_net`. Without them the job silently does nothing (selfies older than 30 days would not be deleted).

```sql
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url',
  'Base URL for pg_net calls from pg_cron')
where not exists (select 1 from vault.secrets where name = 'project_url');

select vault.create_secret('<paste-service-role-key>', 'service_role_key',
  'service_role JWT used by the bhw-storage-cleanup cron job')
where not exists (select 1 from vault.secrets where name = 'service_role_key');
```

After rotating the service_role key later, update the stored value (do not create a second secret):

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'service_role_key'),
  '<paste-new-service-role-key>');
```

**c) Check** (shows names only, never values):

```sql
select name, created_at, updated_at from vault.secrets order by name;
-- expected: profile_encryption_key, project_url, service_role_key
```

### 1.5 Edge Function secrets

`scripts/gen-function-secrets.mjs` writes **fresh random** values to `supabase\functions\.env` and refuses to overwrite an existing file. Your PC already has the dev file there, so move it aside first. Production must never reuse dev secrets.

```powershell
Rename-Item supabase\functions\.env .env.dev.local
node scripts/gen-function-secrets.mjs
Rename-Item supabase\functions\.env .env.production.local
Rename-Item supabase\functions\.env.dev.local .env
```

Cmd: replace `Rename-Item` with `ren` (same arguments).

Both `*.local` names are git-ignored (`.env.*.local` in `.gitignore`). Open `supabase\functions\.env.production.local` in a text editor and set the production values:

| Variable | Production value |
| --- | --- |
| `QR_SIGNING_SECRET`, `PERSONAL_QR_SIGNING_SECRET`, `DEVICE_HASH_PEPPER` | Keep the generated values |
| `DEVICE_SYNC_API_KEY` | **Delete the line** until a fingerprint terminal is installed (the `device-sync` endpoint then rejects every call) |
| `NOTIFY_FROM_EMAIL` | `"BHW Attendance <no-reply@<your-mail-domain>>"` (a sender on the domain verified in Resend) |
| `RESEND_API_KEY` | Add the line `RESEND_API_KEY=<resend-api-key>` for e-mail notifications, or leave it out for in-app notifications only |
| `APP_URL` | `https://<web-domain>` |
| `ALLOWED_ORIGINS` | `https://<web-domain>` (add the Vercel production URL `https://<vercel-project>.vercel.app` only if staff will use it) |

Save the file's contents in Bitwarden (`BHW prod – Edge Function secrets`), then upload and remove the local copy:

```powershell
pnpm supabase secrets set --env-file supabase/functions/.env.production.local --project-ref <your-project-ref>
pnpm supabase secrets list --project-ref <your-project-ref>
Remove-Item supabase\functions\.env.production.local
```

`secrets list` shows names and digests only. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform and must not be set.

### 1.6 Deploy the Edge Functions

```powershell
pnpm supabase functions deploy --use-api --project-ref <your-project-ref>
pnpm supabase functions list --project-ref <your-project-ref>
```

- `--use-api` bundles on Supabase's servers (no Docker needed). The functions import packages with explicit `npm:`/`jsr:` specifiers for this reason.
- `verify_jwt = false` for every function comes from `supabase/config.toml`; the functions authenticate the caller themselves.
- `functions list` must show all 11 as `ACTIVE`: `bind-device`, `device-sync`, `generate-dtr-pdf`, `issue-personal-qr`, `issue-qr-token`, `kiosk-heartbeat`, `log-error`, `record-attendance`, `record-fallback-scan`, `send-notification-email`, `storage-cleanup`.

Quick unauthenticated check (expects HTTP 401 with `"code":"AUTH_REQUIRED"`, which proves the function runs and its secrets loaded):

```powershell
try { Invoke-RestMethod -Method Post -Uri "https://<your-project-ref>.supabase.co/functions/v1/issue-qr-token" -Headers @{ apikey = "<anon-key>" } -ContentType "application/json" -Body "{}" } catch { $_.ErrorDetails.Message }
```

### 1.7 Confirm the pg_cron jobs

The jobs are created by migration `20261101000700` (and `20261101000900` for the end-of-day schedule). In the SQL editor:

```sql
select jobname, schedule, active from cron.job order by jobname;
```

Expected – exactly 6 rows, all `active = true` (cron runs in UTC; Manila = UTC+8):

| jobname | schedule (UTC) | Manila time | Does |
| --- | --- | --- | --- |
| `bhw-end-of-day` | `5 20 * * *` | 04:05 daily | Marks absent / incomplete for the previous work day (follows Settings → overnight cutoff, default 04:00) |
| `bhw-nonce-cleanup` | `0 * * * *` | every hour at :00 | Deletes QR nonces older than 1 day |
| `bhw-offline-kiosks` | `* * * * *` | every minute | Marks a kiosk offline after 3 missed heartbeats, logs a critical error, notifies admins |
| `bhw-periodic-verification` | `0 22 * * 0` | Monday 06:00 | Weekly verification report to admins |
| `bhw-retention` | `30 18 * * *` | 02:30 daily | Retention deletes (D-32) |
| `bhw-storage-cleanup` | `15 18 * * *` | 02:15 daily | Calls `storage-cleanup` through `pg_net` (needs §1.4 b) |

After a few minutes, confirm the jobs actually run:

```sql
select j.jobname, d.status, d.start_time, d.return_message
from cron.job_run_details d join cron.job j using (jobid)
order by d.start_time desc limit 20;
```

`bhw-offline-kiosks` must show `succeeded` once per minute. The next morning, check that `bhw-storage-cleanup` produced an HTTP 200:

```sql
select status_code, created from net._http_response order by created desc limit 5;
```

### 1.8 Verify RLS per role

**Staging (automated).** `scripts/smoke-remote.mjs` (22 checks: anon, employee, viewer, kiosk, admin through the public API) and `scripts/smoke-functions.mjs` (14 checks: kiosk QR → bind → scan → failure codes → heartbeat → log-error → DTR PDF) sign in with the **demo accounts from `seed.sql`** and `smoke-functions` writes a real time-in. Run them **only against a staging project that has the demo seed**, never production:

```powershell
pnpm supabase link --project-ref zzspfykdcjsvpjriomwf
Get-Content supabase\.temp\project-ref
pnpm smoke:remote
pnpm smoke:functions
pnpm supabase link --project-ref <your-project-ref>
```

Both must end with `0 failed`. The second `Get-Content` line must print the **staging** ref before you run the smoke scripts. To build a fresh staging project instead of reusing the dev one: create it like §1.1 (any region), then `pnpm supabase db push --linked --include-seed`, set Edge Function secrets from a separate generated file, deploy functions, and run the two scripts.

**Production (manual, no demo accounts).**

1. RLS is enabled on every public table:

   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
   -- every row must show rowsecurity = true; this must return 0:
   select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;
   ```

2. Storage buckets are private:

   ```sql
   select id, public from storage.buckets order by id;
   -- correction-attachments, profile-photos, selfies: public = false
   ```

3. Anonymous API access returns nothing (expects `0`):

   ```powershell
   (Invoke-RestMethod -Uri "https://<your-project-ref>.supabase.co/rest/v1/profiles?select=id" -Headers @{ apikey = "<anon-key>" }).Count
   ```

4. Per-role checklist on the deployed web portal and app, using the real accounts as they are created during go-live ([04-operations.md §1](04-operations.md#1-go-live-checklist)):

| Role | Account | Do | Expected |
| --- | --- | --- | --- |
| Anonymous | none | Open `https://<web-domain>/admin`, `/viewer`, `/me`, `/kiosk` | Each redirects to `/login` |
| Admin | first admin | Open every item in the sidebar (Dashboard … Settings) | All pages load; Employees shows every account; Audit Log shows the bootstrap inserts |
| Kiosk | kiosk account | Sign in on the kiosk tablet, open `/kiosk`; then type `/admin` in the address bar | QR rotates every 15 s and the station shows **Online** in Device Health; `/admin` redirects back to the kiosk page |
| Viewer | viewer account (if used) | Open `/viewer`, `/viewer/reports`; then `/admin/employees` | Dashboard and reports load without GPS or contact data; `/admin/*` redirects to `/viewer` |
| Employee (pending) | first BHW self-registration, before approval | Sign in on the app and the web | App shows **Waiting for approval**; web shows `/pending` only |
| Employee (active) | same BHW after approval | App: bind phone, scan the kiosk QR, open History; web `/me`; then `/admin` | Time-in recorded; History and `/me` list only this BHW's own records; `/admin` redirects to `/me` |
| Employee (inactive) | deactivate a test case or wait for the first offboarding | Sign in | App: **Account deactivated**; web: signed out with `error=inactive` |

Record the date, tester and result of every row in the go-live checklist.

### 1.9 Auth settings

Dashboard → **Authentication**:

| Area | Setting |
| --- | --- |
| Sign In / Providers → Email | Email provider **enabled**, **Confirm email ON**, Secure email change ON, Secure password change ON, minimum password length **8**. Phone and every OAuth provider **disabled**. Anonymous sign-ins **off**. Allow new users to sign up **on** (BHWs self-register; admins approve). The dev project runs with Confirm email **off** because it has no custom SMTP; do not copy that to production. |
| URL Configuration | Site URL `https://<web-domain>`. Redirect URLs: `https://<web-domain>/auth/callback**` (the web adds `?next=/pending` and `?next=/login/new-password`) and `bhwqr://auth/callback`. Do **not** add `exp://**` or `http://localhost…` on production. |
| SMTP Settings (Emails → SMTP) | **Enable custom SMTP** with Resend: host `smtp.resend.com`, port `465`, username `resend`, password `<resend-api-key>` (a key restricted to sending), sender e-mail `no-reply@<your-mail-domain>`, sender name `BHW Attendance`. The domain must be verified in Resend (SPF + DKIM DNS records) first. The built-in sender delivers only to project members and is rate-limited. |
| Rate Limits | After custom SMTP: e-mails per hour **30** (enough for a registration wave of all BHWs); keep the other defaults. |
| Emails → Templates | Replace **Confirm signup**, **Reset password** and **Change email address** with the bilingual (EN/FIL) texts in [Phase 2 – 05 Privacy and consent §4](../phase-2-architecture/05-privacy-and-consent.md#4-e-mail-templates-supabase-auth). Keep `{{ .ConfirmationURL }}` in each template. |

Then **Project Settings → Data API**: exposed schemas `public`, `graphql_public` only; max rows **1000**.

Test the mail path: register a BHW with a real address you can read, confirm the e-mail arrives (check spam), click the link, and confirm it lands on `https://<web-domain>/pending`.

---

## 2. Frontend Developer – web, kiosk and Android app

### 2.1 Web portal on Vercel (`apps/web`)

Prerequisites: the repository is on GitHub (Vercel deploys from git), CI is green on `main` (§3), and §1 is complete.

1. <https://vercel.com> → barangay team → **Add New… → Project** → import the GitHub repository.
2. **Configure Project:**

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Next.js |
   | Root Directory | `apps/web` (leave **Include files outside the root directory in the Build Step** enabled – the build needs `packages/*`) |
   | Install Command (override) | `cd ../.. && pnpm install --frozen-lockfile` (runs at the repo root so the whole pnpm workspace and lockfile are used) |
   | Build Command (override) | `cd ../.. && pnpm turbo run build --filter=@bhw/web` (builds `@bhw/design-tokens` first, then `next build`) |
   | Output Directory | default (`.next`) |
   | Node.js Version (Settings → Build and Deployment) | **24.x** |

3. **Environment Variables** (Settings → Environment Variables):

   | Name | Production | Preview | Notes |
   | --- | --- | --- | --- |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` | `1` | Makes Vercel use `pnpm@11.1.3` from `packageManager` in the root `package.json` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | staging URL | Public |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production `<anon-key>` | staging anon key | Public; RLS protects data |
   | `NEXT_PUBLIC_APP_URL` | `https://<web-domain>` | leave unset (defaults to `http://localhost:3000`) or the preview URL | Used in auth e-mail redirects |
   | `SUPABASE_SERVICE_ROLE_KEY` | production service_role key, marked **Sensitive** | staging key, or unset | **Server-only.** Never prefix with `NEXT_PUBLIC_`. Needed to create staff accounts (kiosk, viewer, other admins) and store registration photos |

   `NEXT_PUBLIC_*` values are inlined at build time: after changing one, **Redeploy**.

4. **Region:** Settings → Functions → **Function Region** → **Singapore (sin1)**, next to the Supabase project in ap-southeast-1. Redeploy.
5. **Deploy**, then open the `*.vercel.app` URL: the landing page loads, `/login` works with the admin account.
6. **Custom domain:** Settings → Domains → **Add** `<web-domain>` → create the DNS record Vercel shows (a `CNAME` for a subdomain such as `bhw.kalawag2.gov.ph`) at the domain's DNS host → wait for **Valid Configuration** and the HTTPS certificate.
7. **Point everything at the domain:**
   - Supabase → Authentication → URL Configuration: Site URL and Redirect URLs as in §1.9.
   - Edge Function CORS and e-mail links:

     ```powershell
     pnpm supabase secrets set APP_URL=https://<web-domain> ALLOWED_ORIGINS=https://<web-domain> --project-ref <your-project-ref>
     ```

   - Vercel `NEXT_PUBLIC_APP_URL=https://<web-domain>` → Redeploy.
8. Production deployments come from `main` (Settings → Git → Production Branch `main`). Tag each release (`v1.0.0`, `v1.0.1`, …) so a deployment can be traced to a tag. Roll back with Deployments → previous deployment → **Instant Rollback**.

Vercel CLI alternative (from the repo root, after `npm install -g vercel` and `vercel login`): `vercel link`, `vercel env add SUPABASE_SERVICE_ROLE_KEY production`, `vercel --prod`.

### 2.2 Kiosk tablet (summary)

Full steps, hardware list and troubleshooting: [06-kiosk-setup-guide.md](06-kiosk-setup-guide.md).

1. Admin creates the kiosk account: Admin → Employees → **Add staff account** → role **Kiosk** (needs `SUPABASE_SERVICE_ROLE_KEY` on Vercel). Save the password in Bitwarden.
2. Admin → Stations & Kiosks → edit the station from the bootstrap script → link the kiosk account.
3. Android tablet: Chrome → `https://<web-domain>/login` → sign in as the kiosk → open `/kiosk` → **Add to Home screen**; open it from the home-screen icon (full screen, no address bar). Turn on Screen pinning (Settings → Security → App pinning) so staff cannot leave the page.
4. Display: screen timeout **Never** (or Developer options → Stay awake while charging), brightness ≥ 70 %, auto-rotate off, charger always connected, Wi-Fi plus mobile data fallback.
5. Check Admin → Device Health: station **Online**, clock drift < 5 s, last token issued within 15 s.

### 2.3 Android app with EAS Build

Run these from **`apps\mobile`** unless noted. The repository must be a git repository with the changes committed (EAS uploads what git tracks; `.env` stays out because it is git-ignored).

**One-time setup**

```powershell
npm install -g eas-cli
eas login
cd apps\mobile
eas init
```

`eas init` creates the project on expo.dev (use the barangay Expo organisation) and writes `extra.eas.projectId` (and `owner`) into `app.json`. Commit that change.

Make the build profiles load the matching EAS environment and pin the toolchain used by this monorepo. In `apps/mobile/eas.json`, add to each profile:

| Profile | Add |
| --- | --- |
| `development` | `"environment": "development"` |
| `preview` | `"environment": "preview"`, `"node": "24.15.0"`, `"pnpm": "11.1.3"` |
| `production` | `"environment": "production"`, `"node": "24.15.0"`, `"pnpm": "11.1.3"` |

(Use your own `node -v` if it differs.) EAS detects the pnpm workspace from `pnpm-lock.yaml` at the repo root.

**EAS environment variables.** `EXPO_PUBLIC_*` values are compiled into the app and are **not secret** (plaintext visibility is correct). Never add the service_role key or any Edge Function secret here.

```powershell
eas env:create production --name EXPO_PUBLIC_SUPABASE_URL --value https://<your-project-ref>.supabase.co --visibility plaintext --scope project
eas env:create production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --visibility plaintext --scope project
eas env:create production --name EXPO_PUBLIC_WEB_URL --value https://<web-domain> --visibility plaintext --scope project
eas env:create preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<staging-project-ref>.supabase.co --visibility plaintext --scope project
eas env:create preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <staging-anon-key> --visibility plaintext --scope project
eas env:create preview --name EXPO_PUBLIC_WEB_URL --value https://<staging-web-url> --visibility plaintext --scope project
eas env:list production
```

If UAT is run with the real BHWs on the production backend (pilot week), give the `preview` environment the production values instead.

**Versioning.** Before the first production build set `"version": "1.0.0"` in `app.json`.

| Field | Source | Rule |
| --- | --- | --- |
| `expo.version` (Android versionName) | `app.json` | Semantic version shown to users. Bump it for every **native** change (new native module, permission, SDK upgrade). |
| `runtimeVersion` | `appVersion` policy | Equals `expo.version`, so an OTA update only reaches builds with the same version. |
| Android versionCode | EAS remote (`appVersionSource: remote`, `autoIncrement` on `production`) | Increases automatically on every production build. Check with `eas build:version:get -p android`. |

**OTA updates (EAS Update)** – set up once, **before** the first build that goes to phones (only builds that contain `expo-updates` can receive updates):

```powershell
npx expo install expo-updates
eas update:configure
```

`update:configure` adds `updates.url` to `app.json`; `runtimeVersion` (appVersion policy) and the `channel` of each build profile are already set. Commit the changes.

**Build**

```powershell
eas build -p android --profile preview
eas build -p android --profile production
```

| Profile | Artifact | Use |
| --- | --- | --- |
| `preview` | APK, internal distribution, channel `preview` | UAT on BHW phones (sideload) |
| `production` | AAB, channel `production` | Google Play |

**Signing.** On the first Android build answer **Yes** to "Generate a new Android Keystore?". EAS stores it. Back it up immediately: `eas credentials -p android` → profile `production` → **Keystore → Download credentials** → save the `.jks` file and its passwords in Bitwarden (`BHW prod – Android upload keystore`), then delete the local copy. With Play App Signing (next step) this keystore is the **upload key**; Google holds the app signing key.

**Ship a JavaScript-only fix (OTA)**

```powershell
eas update --channel production --environment production --message "Fix: <short description>"
eas update --channel preview --environment preview --message "UAT: <short description>"
```

Phones download the update on the next app start and apply it on the following start. Roll back by republishing the previous update group: `eas update:list --branch production`, then `eas update:republish --group <previous-update-group-id>`. Native changes always need a new build with a bumped `version`.

### 2.4 Distribution to BHW phones

**UAT – APK sideload (preview build)**

1. When `eas build --profile preview` finishes, it prints an install URL and QR code (also on expo.dev → Builds).
2. On each BHW phone: scan the QR or open the link in Chrome → **Download** → open the APK → allow **Install unknown apps** for Chrome when Android asks → **Install** (if Play Protect warns, choose **Install anyway**; the app is unsigned by Play, not unsafe).
3. Open **BHW Attendance**, sign in, bind the phone, do one test scan at the kiosk.
4. After UAT, turn **Install unknown apps** off again for Chrome.

**Production – Google Play internal testing**

1. Google Play Console (barangay developer account) → **Create app** "BHW Attendance", package `ph.gov.kalawag2.bhwattendance`, free, App → enrol in **Play App Signing**.
2. Complete the required declarations (privacy policy URL `https://<web-domain>/privacy`, data safety: location used only at scan time, camera for QR, no data sold; target audience: adults; app access: give the reviewer a test account).
3. **Testing → Internal testing → Create release** → upload the first `.aab` **manually** (download it from expo.dev → Builds). Google requires the first upload through the Console.
4. **Testers** → create the list "BHW Kalawag II" with each BHW's Google account e-mail → copy the opt-in link and send it to the BHWs (group chat). Each BHW opens it, accepts, and installs from the Play Store; updates then arrive automatically.
5. Later releases from the CLI: create a Google Cloud service account with Play Console release access, save its JSON key in Bitwarden and locally outside the repo, and add to `eas.json`:

   ```json
   "submit": {
     "production": {
       "android": {
         "serviceAccountKeyPath": "<path-to-service-account-key.json>",
         "track": "internal"
       }
     }
   }
   ```

   ```powershell
   eas build -p android --profile production --auto-submit
   ```

   (or `eas submit -p android --profile production --latest` for an existing build). Never commit the JSON key.
6. Promote internal → production track only after the go-live checklist is complete. Internal testing already covers up to 100 testers, which is enough for the BHW office.

---

## 3. Software Engineer – CI pipeline

File: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Runs on every push to `main` and every pull request into `main`; a newer run on the same branch cancels the older one. No repository secrets are needed.

| Job | Runner steps | Fails when |
| --- | --- | --- |
| **node** | checkout → `pnpm/action-setup@v4` (pnpm 11.1.3 from `packageManager`) → `actions/setup-node@v4` (Node 24, pnpm store cache) → `pnpm install --frozen-lockfile` → `pnpm turbo run lint typecheck test` (all workspaces: design-tokens, types, web Vitest, mobile Jest) → `pnpm --filter @bhw/web build` with dummy `NEXT_PUBLIC_*` values | Lockfile out of date, ESLint/`expo lint` problems, TypeScript errors, failing unit tests, broken Next.js build |
| **deno** | checkout → `denoland/setup-deno@v2` (Deno 2.x) → in `supabase/functions`: `deno test --allow-env` and `deno check */index.ts` | Failing Edge Function tests (21) or a type error in any of the 11 functions |
| **database** | checkout → `supabase/setup-cli@v1` (CLI 2.122.0, same as the devDependency) → `supabase start -x studio,logflare,vector,imgproxy,edge-runtime` → `supabase db reset` (all migrations + demo seed) → `supabase test db` (pgTAP files in `supabase/tests/database`) → `supabase stop` | A migration does not apply to an empty database, or any pgTAP assertion (status logic, `record_scan`, RLS per role, corrections/DTR/jobs) fails |

Not in CI, by design:

- **Playwright** (`apps/web/e2e`) needs a running Supabase with Edge Functions and real keys; run it locally before a release (`pnpm --filter @bhw/web test:e2e`).
- **Smoke scripts** need the hosted staging project (§1.8).
- **Deployments.** Vercel deploys from git by itself; Supabase migrations and functions are pushed by the Backend Developer (§1); EAS builds are started by the Frontend Developer (§2.3).

Branch protection on `main` (GitHub → Settings → Branches): require a pull request with 1 review and the status checks **node**, **deno** and **database** to pass (Phase 2 engineering standards). The `database` job takes the longest (Docker image pulls); expect about 5–8 minutes.
