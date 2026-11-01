-- =============================================================================
-- Helper functions: roles, Manila time, geofence math, schedules, status computation,
-- PII encryption, profile-on-signup trigger, updated_at trigger.
-- SECURITY DEFINER functions pin search_path = '' and qualify every name.
-- =============================================================================

-- updated_at maintenance -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger schedules_updated_at before update on public.schedules
  for each row execute function public.set_updated_at();
create trigger stations_updated_at before update on public.stations
  for each row execute function public.set_updated_at();
create trigger attendance_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
create trigger correction_updated_at before update on public.correction_requests
  for each row execute function public.set_updated_at();

-- Roles ------------------------------------------------------------------------
-- app_role(): role of the calling user, NULL when anonymous or no profile.
create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- The spec names this helper current_role(). CURRENT_ROLE is an SQL keyword, so the function
-- must always be called schema-qualified and quoted: public."current_role"().
create or replace function public."current_role"()
returns public.user_role
language sql
stable
set search_path = ''
as $$
  select public.app_role();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.is_viewer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'viewer') and p.status = 'active'
  );
$$;

create or replace function public.is_active_employee(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and p.role = 'employee' and p.status = 'active'
  );
$$;

-- Raises a FORBIDDEN error unless the caller is an active admin. Used by admin RPCs.
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501', hint = 'Admin role required';
  end if;
end;
$$;

-- Manila time (BR-01) ------------------------------------------------------------
create or replace function public.manila_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Manila')::date;
$$;

-- Manila wall-clock timestamp truncated to the minute (BR-03).
create or replace function public.manila_minute(p_ts timestamptz)
returns timestamp
language sql
immutable
set search_path = ''
as $$
  select date_trunc('minute', p_ts at time zone 'Asia/Manila');
$$;

-- Converts a Manila work date + wall-clock time to timestamptz.
create or replace function public.manila_ts(p_date date, p_time time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date + p_time) at time zone 'Asia/Manila';
$$;

-- Geofence (decisions §D step 12) -------------------------------------------------
create or replace function public.haversine_distance_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns double precision
language sql
immutable
strict
set search_path = ''
as $$
  select 2 * 6371008.8 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ));
$$;

-- Schedules (D-19) ----------------------------------------------------------------
create or replace function public.schedule_for(p_employee_id uuid, p_date date)
returns public.schedules
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.employee_schedules es
  join public.schedules s on s.id = es.schedule_id
  where es.employee_id = p_employee_id
    and es.effective_from <= p_date
    and (es.effective_to is null or es.effective_to >= p_date)
  order by es.effective_from desc
  limit 1;
$$;

-- TRUE when p_date is a scheduled work day for the employee and not a holiday.
create or replace function public.is_work_day(p_employee_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select extract(isodow from p_date)::int = any (s.work_days)
     from public.schedule_for(p_employee_id, p_date) s
     where s.id is not null),
    false
  )
  and not exists (select 1 from public.holidays h where h.date = p_date);
$$;

-- Status computation (D-15, D-16, D-17, D-18, BR-03) --------------------------------
-- Pure function of the times and the schedule in effect; used by every write path so that
-- kiosk scans, fallback, manual entry, corrections, device-sync, recompute and the end-of-day
-- job always agree. p_day_closed = TRUE once the work day is over (end-of-day job), which turns
-- a missing time-out into 'incomplete'.
create or replace function public.compute_attendance_status(
  p_employee_id uuid,
  p_work_date date,
  p_time_in timestamptz,
  p_time_out timestamptz,
  p_day_closed boolean default false,
  out status public.attendance_status,
  out minutes_late int,
  out undertime_minutes int,
  out note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.schedules;
  v_holiday text;
  v_in timestamp;
  v_out timestamp;
begin
  minutes_late := 0;
  undertime_minutes := 0;
  note := null;

  if p_time_in is null then
    status := 'absent';
    return;
  end if;

  select * into v_s from public.schedule_for(p_employee_id, p_work_date);
  select h.name into v_holiday from public.holidays h where h.date = p_work_date;

  if v_s.id is null then
    note := 'No schedule assigned';
  elsif v_holiday is not null then
    note := v_holiday;
  elsif not (extract(isodow from p_work_date)::int = any (v_s.work_days)) then
    note := 'Non-working day';
  else
    v_in := public.manila_minute(p_time_in);
    if v_in > (p_work_date + v_s.start_time) + make_interval(mins => v_s.grace_minutes) then
      minutes_late := floor(extract(epoch from v_in - (p_work_date + v_s.start_time)) / 60)::int;
    end if;
    if p_time_out is not null then
      v_out := public.manila_minute(p_time_out);
      undertime_minutes := greatest(
        0, floor(extract(epoch from (p_work_date + v_s.end_time) - v_out) / 60)::int
      );
    end if;
  end if;

  status := case
    when p_time_out is null and p_day_closed then 'incomplete'
    when minutes_late > 0 then 'late'
    when undertime_minutes > 0 then 'undertime'
    else 'on_time'
  end::public.attendance_status;
end;
$$;

-- Settings ------------------------------------------------------------------------
create or replace function public.settings()
returns public.app_settings
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.app_settings where id = 1;
$$;

-- PII encryption (D-29) -------------------------------------------------------------
-- Key lives in Supabase Vault as 'profile_encryption_key'; never in a migration or env file.
create or replace function public.pii_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  where ds.name = 'profile_encryption_key';
  if v_key is null then
    raise exception 'Vault secret profile_encryption_key is missing';
  end if;
  return v_key;
end;
$$;
revoke all on function public.pii_key() from public, anon, authenticated;

create or replace function public.encrypt_pii(p_value text)
returns bytea
language sql
stable
security definer
set search_path = ''
as $$
  select case when nullif(btrim(p_value), '') is null then null
    else extensions.pgp_sym_encrypt(btrim(p_value), public.pii_key(), 'cipher-algo=aes256') end;
$$;
revoke all on function public.encrypt_pii(text) from public, anon, authenticated;

create or replace function public.decrypt_pii(p_value bytea)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_value is null then null
    else extensions.pgp_sym_decrypt(p_value, public.pii_key()) end;
$$;
revoke all on function public.decrypt_pii(bytea) from public, anon, authenticated;

-- Owner or admin reads the decrypted contact number and address (FR-07, BR 3.1).
create or replace function public.get_profile_private(p_profile_id uuid)
returns table (contact_number text, address text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from p_profile_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select public.decrypt_pii(p.contact_number_enc), public.decrypt_pii(p.address_enc)
    from public.profiles p where p.id = p_profile_id;
end;
$$;

-- Employee edits own contact number / address / photo path (FR-18).
create or replace function public.update_my_contact(
  p_contact_number text,
  p_address text,
  p_photo_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_contact_number !~ '^09\d{9}$' then
    raise exception 'INVALID_REQUEST' using errcode = '22023', detail = 'contact_number';
  end if;
  update public.profiles
  set contact_number_enc = public.encrypt_pii(p_contact_number),
      address_enc = public.encrypt_pii(p_address),
      photo_url = coalesce(p_photo_url, photo_url)
  where id = auth.uid();
end;
$$;

-- Profile-on-signup trigger (FR-05, D-02) -------------------------------------------
-- Self-registration always creates employee/pending from raw_user_meta_data.
-- Admin, kiosk and viewer accounts are created with the service role and carry the role in
-- raw_app_meta_data (clients cannot set app metadata), and start active.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_app_role text := new.raw_app_meta_data ->> 'role';
begin
  if v_app_role in ('admin', 'kiosk', 'viewer') then
    insert into public.profiles (id, full_name, email, role, status)
    values (
      new.id,
      coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), split_part(new.email, '@', 1)),
      lower(new.email),
      v_app_role::public.user_role,
      'active'
    );
    return new;
  end if;

  if coalesce((v_meta ->> 'consent')::boolean, false) is not true then
    raise exception 'CONSENT_REQUIRED' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles p
    where upper(p.bhw_id_number) = upper(btrim(v_meta ->> 'bhw_id_number'))
  ) then
    raise exception 'BHW_ID_TAKEN' using errcode = '23505';
  end if;

  insert into public.profiles (
    id, full_name, bhw_id_number, area, email, contact_number_enc, address_enc,
    role, status, consent_at
  ) values (
    new.id,
    btrim(v_meta ->> 'full_name'),
    upper(btrim(v_meta ->> 'bhw_id_number')),
    btrim(v_meta ->> 'area'),
    lower(new.email),
    public.encrypt_pii(v_meta ->> 'contact_number'),
    public.encrypt_pii(v_meta ->> 'address'),
    'employee',
    'pending',
    now()
  );

  -- Contact number and address must not linger in auth metadata in plain text (D-29).
  update auth.users
  set raw_user_meta_data = raw_user_meta_data - 'contact_number' - 'address'
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when the auth e-mail changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Kiosk link must point to a kiosk profile (D-03).
create or replace function public.check_station_kiosk_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kiosk_user_id is not null and not exists (
    select 1 from public.profiles p where p.id = new.kiosk_user_id and p.role = 'kiosk'
  ) then
    raise exception 'kiosk_user_id must reference a profile with role kiosk';
  end if;
  return new;
end;
$$;

create trigger stations_kiosk_user_check before insert or update of kiosk_user_id on public.stations
  for each row execute function public.check_station_kiosk_user();

-- Notifications helper ---------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid, p_kind public.notification_kind, p_title text, p_body text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body)
  values (p_user_id, p_kind, left(p_title, 120), left(p_body, 1000));
$$;
revoke all on function public.notify_user(uuid, public.notification_kind, text, text)
  from public, anon, authenticated;

create or replace function public.notify_admins(
  p_kind public.notification_kind, p_title text, p_body text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body)
  select p.id, p_kind, left(p_title, 120), left(p_body, 1000)
  from public.profiles p
  where p.role = 'admin' and p.status = 'active';
$$;
revoke all on function public.notify_admins(public.notification_kind, text, text)
  from public, anon, authenticated;

-- Server-side error logging from SQL (cron jobs, triggers) --------------------------
create or replace function public.log_error_internal(
  p_source public.error_source, p_severity public.error_severity, p_message text,
  p_context jsonb default '{}'::jsonb, p_user_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.error_logs (source, severity, message, context, user_id)
  values (p_source, p_severity, left(p_message, 1000), coalesce(p_context, '{}'::jsonb), p_user_id);
$$;
revoke all on function public.log_error_internal(public.error_source, public.error_severity, text, jsonb, uuid)
  from public, anon, authenticated;
