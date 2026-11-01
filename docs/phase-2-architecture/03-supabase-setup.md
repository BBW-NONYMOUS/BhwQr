# 03 – Supabase Setup and Local Development

> **Role speaking: System Administrator** (Backend Developer notes inline)

## 1. Local development with the Supabase CLI

Prerequisites: Docker Desktop running, Node 20.18+ (24 recommended), pnpm 11. The CLI is a dev dependency of the repo (`supabase` in root `package.json`), so no global install is needed.

```bash
pnpm install
pnpm db:start            # supabase start: Postgres, Auth, Storage, Realtime, Studio, Inbucket
pnpm db:reset            # apply supabase/migrations/* then supabase/seed.sql
pnpm db:types            # regenerate packages/types/src/database.types.ts
cp supabase/functions/.env.example supabase/functions/.env   # then fill the secrets
pnpm functions:serve     # serve all Edge Functions with hot reload
pnpm db:test             # pgTAP tests in supabase/tests
```

`supabase start` prints the local API URL (`http://127.0.0.1:54321`), the anon/publishable key and the service-role key. Put the anon key in `apps/web/.env.local` and `apps/mobile/.env`. Local e-mails (verification links) are visible in Inbucket/Mailpit at `http://127.0.0.1:54324`. Studio runs at `http://127.0.0.1:54323`.

For a **physical phone** on the same Wi-Fi, use the PC's LAN IP in `EXPO_PUBLIC_SUPABASE_URL` (e.g. `http://192.168.1.10:54321`), and allow port 54321 in Windows Firewall.

## 2. Hosted project setup (one-time)

| Step | Where | Setting |
| --- | --- | --- |
| 1 | supabase.com → New project | Name `bhw-qr-attendance`, region **Southeast Asia (Singapore)** (closest to PH), strong DB password stored in the barangay password manager. |
| 2 | Link CLI | `pnpm supabase login` then `pnpm supabase link --project-ref <ref>` |
| 3 | Push schema | `pnpm supabase db push` (migrations only; never run `seed.sql` in production — see Phase 6 for the production bootstrap script). |
| 4 | Auth → Providers → Email | Enable email provider, **Confirm email ON** (D-04), Secure password change ON, minimum password length 8. Disable phone/SMS and all OAuth providers. |
| 5 | Auth → URL configuration | Site URL `https://<web-domain>`; Redirect URLs: `https://<web-domain>/auth/callback`, `bhwqr://auth/callback` (mobile deep link), `exp://**` only on the staging project. |
| 6 | Auth → SMTP | Use a custom SMTP sender (Resend SMTP or the LGU mail server) — the built-in sender is rate-limited and not for production. |
| 7 | Auth → Email templates | Replace templates with the bilingual texts in `05-privacy-and-consent.md` §4. |
| 8 | Storage | Buckets are created by migration (`profile-photos`, `selfies`, `correction-attachments`, all private). Verify none is public. |
| 9 | Database → Extensions | `pgcrypto`, `pg_cron`, `pg_net` (for e-mail calls from cron), `supabase_vault` (enabled by default), `btree_gist` (schedule overlap), `pgtap` (test only, local). Migrations run `create extension if not exists`. |
| 10 | Vault | `select vault.create_secret('<32-byte base64>', 'profile_encryption_key');` — run once from SQL editor; never in a migration file. |
| 11 | Edge Function secrets | `pnpm supabase secrets set --env-file supabase/functions/.env` (values from `.env.example`, generated fresh for production). |
| 12 | Deploy functions | `pnpm supabase functions deploy` (all). `device-sync` is deployed but rejects calls until `DEVICE_SYNC_API_KEY` is set. |
| 13 | Realtime | Publication `supabase_realtime` is set by migration to `attendance_records`, `stations`, `correction_requests`, `notifications`. |
| 14 | API settings | Max rows 1000 (reports use RPCs with explicit limits). Keep `public` and `graphql_public` exposed only. |
| 15 | Backups | Pro plan: daily backups + PITR (see `04-operations-and-security.md` §2). Free plan: run the nightly `pg_dump` job. |

## 3. Deep links (mobile)

| Purpose | URL | Handled by |
| --- | --- | --- |
| Email verification / password reset opened on the phone | `bhwqr://auth/callback#access_token=...` | Expo Router route `app/auth/callback.tsx` → `supabase.auth.setSession` |
| Opening the app from a notification e-mail | `bhwqr://history`, `bhwqr://requests` | Expo Router file routes |
| Development (Expo Go) | `exp://<lan-ip>:8081/--/auth/callback` | Allowed only on local/staging projects |

The scheme `bhwqr` is set in `apps/mobile/app.json` (`expo.scheme`).

## 4. Storage buckets

| Bucket | Public | Max size | MIME types | Path convention | Who can write / read |
| --- | --- | --- | --- | --- | --- |
| `profile-photos` | No | 5 MB | jpeg, png, webp | `<user_id>/<file>` | Owner uploads during registration/profile edit; owner + admin read via signed URL |
| `selfies` | No | 2 MB | jpeg, webp | `<user_id>/<yyyy-mm-dd>/<scan_id>.jpg` | Owner uploads before a scan; admin reads; deleted after 30 days (D-32) |
| `correction-attachments` | No | 5 MB | jpeg, png, webp, pdf | `<user_id>/<request_id>/<file>` | Owner uploads; owner + admin read |

> **Backend Developer note:** Storage RLS policies on `storage.objects` check `(storage.foldername(name))[1] = auth.uid()::text` for owners and `public.is_admin()` for admins; they are in the Phase 3 storage migration.

## 5. Environment files

| File | Committed? | Contents | Secret? |
| --- | --- | --- | --- |
| `apps/web/.env.example` → `.env.local` | example only | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Only `SUPABASE_SERVICE_ROLE_KEY` (**server-only**, never `NEXT_PUBLIC_`) |
| `apps/mobile/.env.example` → `.env` | example only | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | None — bundled into the app |
| `supabase/functions/.env.example` → `.env` | example only | `QR_SIGNING_SECRET(_PREVIOUS)`, `PERSONAL_QR_SIGNING_SECRET(_PREVIOUS)`, `DEVICE_HASH_PEPPER`, `DEVICE_SYNC_API_KEY`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `APP_URL`, `ALLOWED_ORIGINS` | **All server-only** |
| Vault secret `profile_encryption_key` | never in files | pgcrypto key for contact number and address | **Server-only**, inside Postgres |
