-- =============================================================================
-- BHW QR Attendance System – PRODUCTION BOOTSTRAP
--
-- Run ONCE on the production project, AFTER `supabase db push` has applied every migration
-- (20261101000000 … 20261101000900). Never run supabase/seed.sql in production: it creates demo
-- accounts with a published password.
--
-- What this script does (every step is idempotent – running it again changes nothing):
--   1. Creates the Vault secret `profile_encryption_key` (pgcrypto key for contact number and
--      address, D-29) – only if it does not exist yet.
--   2. Inserts the first station (the BHW office kiosk spot).
--   3. Inserts the default schedule "Regular Mon–Fri 08:00–17:00" (grace 15 min, break 12–13).
--   4. Inserts the 2026 Philippine regular holidays.
--   5. OPTIONAL: creates the first admin account with a temporary password.
--      Recommended instead: create the admin with the Auth Admin API (see
--      docs/phase-6-deployment/04-operations.md §2). Leave the admin values empty to skip.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste this whole file → edit ONLY the values in
--   section 0 → Run. Do not save the query as a snippet (it contains the key while you edit it).
--   Afterwards, clear the editor tab.
--
--   psql alternative (Windows PowerShell, Session pooler connection string from
--   Project Settings → Database → Connect):
--     psql "<your-session-pooler-connection-string>" -v ON_ERROR_STOP=1 -f scripts/bootstrap-production.sql
--   (edit section 0 in a local copy first; never commit the edited copy).
--
-- Values written as <...> are OPERATOR-SUPPLIED. The script stops with an error if a <...>
-- placeholder that it needs is still present, so a half-edited run changes nothing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. OPERATOR VALUES – edit this block only
-- -----------------------------------------------------------------------------

-- 0.1 Profile encryption key (32 random bytes, base64). Generate it on your PC, save it in the
--     barangay password manager (Bitwarden item "BHW prod – profile_encryption_key") FIRST, then
--     paste it below. Windows PowerShell or Cmd:
--       node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
--     Keep the backup: Vault secrets are encrypted per project, so a database dump restored into a
--     NEW project cannot decrypt contact numbers and addresses without this key.
--     If the secret already exists (re-run), this value is ignored and may stay as the placeholder.
select set_config('bootstrap.profile_key', '<paste-generated-profile-encryption-key>', false);

-- 0.2 First station. Measure the coordinates at the kiosk spot (04-operations.md §3).
--     Latitude/longitude in decimal degrees, 6 decimals, e.g. 6.631100 and 124.604700.
--     Radius: empty = use the Settings default (100 m); otherwise 50–100 (metres).
select set_config('bootstrap.station_name', 'BHW Office – Main Entrance', false);
select set_config('bootstrap.station_lat', '<station-latitude>', false);
select set_config('bootstrap.station_lng', '<station-longitude>', false);
select set_config('bootstrap.station_radius_m', '', false);

-- 0.3 OPTIONAL first admin. Leave all three EMPTY ('') to skip and create the admin with the
--     Auth Admin API instead (recommended). If you fill them in, the temporary password must be at
--     least 12 characters; the admin must change it on first login ("Forgot password?" on /login).
select set_config('bootstrap.admin_email', '', false);
select set_config('bootstrap.admin_full_name', '', false);
select set_config('bootstrap.admin_temp_password', '', false);

-- -----------------------------------------------------------------------------
-- 1. Vault secret profile_encryption_key (only if missing)
-- -----------------------------------------------------------------------------
do $$
declare
  v_key text := current_setting('bootstrap.profile_key', true);
begin
  if exists (select 1 from vault.secrets where name = 'profile_encryption_key') then
    raise notice 'profile_encryption_key already exists in Vault – not changed.';
    return;
  end if;
  if v_key is null or v_key like '<%' or char_length(v_key) < 32 then
    raise exception 'Set bootstrap.profile_key in section 0.1 to a generated key (at least 32 characters).';
  end if;
  perform vault.create_secret(v_key, 'profile_encryption_key',
    'pgcrypto key for profiles.contact_number_enc / address_enc (D-29)');
  raise notice 'profile_encryption_key created in Vault.';
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. First station
-- -----------------------------------------------------------------------------
do $$
declare
  v_name text := btrim(current_setting('bootstrap.station_name', true));
  v_lat text := btrim(current_setting('bootstrap.station_lat', true));
  v_lng text := btrim(current_setting('bootstrap.station_lng', true));
  v_radius text := btrim(coalesce(current_setting('bootstrap.station_radius_m', true), ''));
begin
  if v_name is null or v_name = '' or v_name like '<%' then
    raise exception 'Set bootstrap.station_name in section 0.2.';
  end if;
  if exists (select 1 from public.stations where name = v_name) then
    raise notice 'Station "%" already exists – not changed.', v_name;
    return;
  end if;
  if v_lat is null or v_lat like '<%' or v_lng is null or v_lng like '<%' then
    raise exception 'Set bootstrap.station_lat and bootstrap.station_lng in section 0.2.';
  end if;
  if v_radius <> '' then
    if v_radius !~ '^\d{1,4}$' then
      raise exception 'bootstrap.station_radius_m must be empty or a whole number between 50 and 100.';
    end if;
    if v_radius::int not between 50 and 100 then
      raise exception 'bootstrap.station_radius_m must be empty or a whole number between 50 and 100.';
    end if;
  end if;

  insert into public.stations (name, latitude, longitude, radius_m, is_active)
  values (v_name, v_lat::numeric(9, 6), v_lng::numeric(9, 6), nullif(v_radius, '')::int, true)
  on conflict do nothing;
  raise notice 'Station "%" created at (%, %). Link the kiosk account in Admin → Stations & Kiosks.',
    v_name, v_lat, v_lng;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Default schedule (ISO weekdays 1 = Monday … 5 = Friday)
-- -----------------------------------------------------------------------------
insert into public.schedules (name, work_days, start_time, end_time, grace_minutes, break_start, break_end)
values ('Regular Mon–Fri 08:00–17:00', array[1, 2, 3, 4, 5], '08:00', '17:00', 15, '12:00', '13:00')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. 2026 Philippine regular holidays (RA 9492 as amended; Holy Week from Easter 2026-04-05;
--    National Heroes Day = last Monday of August).
--    Eid'l Fitr and Eid'l Adha are regular holidays too, but their dates are fixed each year by
--    presidential proclamation – add them in Admin → Holidays once proclaimed. Special
--    (non-working) days such as All Saints' Day, 8 Dec, 24 Dec and 31 Dec are added the same way
--    if the office is closed. Next year's holidays are entered in Admin → Holidays each December.
-- -----------------------------------------------------------------------------
insert into public.holidays (date, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-04-02', 'Maundy Thursday'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-09', 'Araw ng Kagitingan'),
  ('2026-05-01', 'Labor Day'),
  ('2026-06-12', 'Independence Day'),
  ('2026-08-31', 'National Heroes Day'),
  ('2026-11-30', 'Bonifacio Day'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-30', 'Rizal Day')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 5. OPTIONAL first admin (skipped when bootstrap.admin_email is empty)
--    Mirrors supabase/seed.sql: handle_new_user() reads raw_app_meta_data ->> 'role'; for
--    'admin', 'kiosk' and 'viewer' it creates an ACTIVE profile with that role (no BHW ID or
--    consent needed). Without that role the trigger treats the user as a BHW self-registration
--    and rejects it with CONSENT_REQUIRED.
-- -----------------------------------------------------------------------------
do $$
declare
  v_email text := lower(btrim(coalesce(current_setting('bootstrap.admin_email', true), '')));
  v_name text := btrim(coalesce(current_setting('bootstrap.admin_full_name', true), ''));
  v_password text := coalesce(current_setting('bootstrap.admin_temp_password', true), '');
  v_id uuid := gen_random_uuid();
begin
  if v_email = '' then
    raise notice 'Admin values empty – admin account not created here (use the Auth Admin API).';
    return;
  end if;
  if v_email like '<%' or v_email not like '%_@_%._%' then
    raise exception 'bootstrap.admin_email is not a valid e-mail address.';
  end if;
  if v_name = '' or v_name like '<%' then
    raise exception 'Set bootstrap.admin_full_name.';
  end if;
  if char_length(v_password) < 12 or v_password like '<%' then
    raise exception 'bootstrap.admin_temp_password must be at least 12 characters.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise notice 'A user with e-mail % already exists – not changed.', v_email;
    return;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    jsonb_build_object('full_name', v_name), now(), now(), '', '', '', '')
  on conflict do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', null, now(), now())
  on conflict do nothing;

  raise notice 'Admin % created. Sign in at the web portal and change the temporary password now.', v_email;
end;
$$;

-- Clear the operator values from this session before committing.
select set_config('bootstrap.profile_key', '', false),
       set_config('bootstrap.admin_temp_password', '', false);

commit;

-- -----------------------------------------------------------------------------
-- 6. Verification (read-only). Expected: key_present = true, 1+ station, 1+ schedule,
--    10+ holidays for 2026, and admins = 1 if you created the admin here or via the API.
-- -----------------------------------------------------------------------------
select
  exists (select 1 from vault.secrets where name = 'profile_encryption_key') as key_present,
  (select count(*) from public.stations) as stations,
  (select count(*) from public.schedules) as schedules,
  (select count(*) from public.holidays where extract(year from date) = 2026) as holidays_2026,
  (select count(*) from public.profiles where role = 'admin' and status = 'active') as admins;
