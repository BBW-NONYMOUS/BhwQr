-- =============================================================================
-- Attendance core: one punch path for kiosk scans, fallback scans and device-sync, plus the
-- validation pipeline of record-attendance (decisions §D). Called by Edge Functions with the
-- service role; never granted to anon/authenticated.
-- =============================================================================

-- Decides where a punch at p_at goes (D-13, D-14).
--   action = 'time_in'  -> no record, or the job's 'absent' row, for the Manila date of p_at
--   action = 'time_out' -> record with time_in and no time_out (also previous day before cutoff)
--   action = 'completed'-> record already has both (ALREADY_COMPLETED)
create or replace function public.resolve_punch(
  p_employee_id uuid,
  p_at timestamptz,
  out action text,
  out work_date date,
  out record_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Manila';
  v_cutoff int := (select s.overnight_cutoff_hour from public.app_settings s where s.id = 1);
  v_rec public.attendance_records;
begin
  -- Overnight rule: before the cutoff, an open record of the previous day takes the time-out.
  if extract(hour from v_local) < v_cutoff then
    select * into v_rec from public.attendance_records ar
    where ar.employee_id = p_employee_id
      and ar.work_date = v_local::date - 1
      and ar.time_in is not null and ar.time_out is null;
    if found then
      action := 'time_out'; work_date := v_rec.work_date; record_id := v_rec.id;
      return;
    end if;
  end if;

  work_date := v_local::date;
  select * into v_rec from public.attendance_records ar
  where ar.employee_id = p_employee_id and ar.work_date = v_local::date;

  if not found or v_rec.status = 'absent' then
    action := 'time_in';
  elsif v_rec.time_out is null then
    action := 'time_out';
  else
    action := 'completed';
  end if;
  record_id := v_rec.id;
end;
$$;

-- Writes a punch and returns the updated record. Status is recomputed with the shared function.
create or replace function public.apply_punch(
  p_employee_id uuid,
  p_at timestamptz,
  p_station_id uuid,
  p_method public.attendance_method,
  p_actor uuid,
  p_scan_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p record;
  v_c record;
  v_rec public.attendance_records;
begin
  select * into v_p from public.resolve_punch(p_employee_id, p_at);
  if v_p.action = 'completed' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_COMPLETED');
  end if;

  perform public.set_audit_context('scan_' || v_p.action, p_actor);

  if v_p.action = 'time_in' then
    select * into v_c from public.compute_attendance_status(p_employee_id, v_p.work_date, p_at, null, false);
    insert into public.attendance_records as ar (
      employee_id, work_date, time_in, time_out, station_id, status, minutes_late,
      undertime_minutes, method, notes, created_by, time_in_scan_id
    ) values (
      p_employee_id, v_p.work_date, p_at, null, p_station_id, v_c.status, v_c.minutes_late,
      0, p_method, coalesce(p_notes, v_c.note), p_actor, p_scan_id
    )
    on conflict (employee_id, work_date) do update
      set time_in = excluded.time_in, station_id = excluded.station_id, status = excluded.status,
          minutes_late = excluded.minutes_late, undertime_minutes = 0, method = excluded.method,
          notes = excluded.notes, created_by = excluded.created_by,
          time_in_scan_id = excluded.time_in_scan_id
      where ar.status = 'absent'
    returning * into v_rec;
  else
    select * into v_rec from public.attendance_records where id = v_p.record_id for update;
    if v_rec.time_out is not null then
      return jsonb_build_object('ok', false, 'code', 'ALREADY_COMPLETED');
    end if;
    select * into v_c from public.compute_attendance_status(
      p_employee_id, v_rec.work_date, v_rec.time_in, p_at, false);
    update public.attendance_records
    set time_out = p_at, status = v_c.status, minutes_late = v_c.minutes_late,
        undertime_minutes = v_c.undertime_minutes, time_out_scan_id = p_scan_id,
        notes = coalesce(p_notes, notes, v_c.note)
    where id = v_rec.id
    returning * into v_rec;
  end if;

  if v_rec.id is null then
    -- Lost a race with another punch for the same day.
    return jsonb_build_object('ok', false, 'code', 'ALREADY_COMPLETED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', v_p.action,
    'recordId', v_rec.id,
    'workDate', v_rec.work_date,
    'recordedAt', p_at,
    'time', to_char(p_at at time zone 'Asia/Manila', 'HH24:MI'),
    'status', v_rec.status,
    'minutesLate', v_rec.minutes_late,
    'undertimeMinutes', v_rec.undertime_minutes
  );
end;
$$;
revoke all on function public.apply_punch(uuid, timestamptz, uuid, public.attendance_method, uuid, uuid, text)
  from public, anon, authenticated;

-- Writes one scan_attempts row (also used for failures) and returns its id.
create or replace function public.log_scan_attempt(
  p_employee_id uuid, p_station_id uuid, p_code text, p_reason text, p_lat double precision,
  p_lng double precision, p_accuracy double precision, p_device_hash text, p_nonce uuid,
  p_selfie_path text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.scan_attempts (
    employee_id, station_id, success, error_code, failure_reason, lat, lng, accuracy,
    device_id_hash, nonce, selfie_path
  ) values (
    p_employee_id,
    (select s.id from public.stations s where s.id = p_station_id),
    p_code is null, p_code, left(p_reason, 500), p_lat, p_lng, p_accuracy,
    p_device_hash, p_nonce, p_selfie_path
  )
  returning id;
$$;
revoke all on function public.log_scan_attempt(uuid, uuid, text, text, double precision,
  double precision, double precision, text, uuid, text) from public, anon, authenticated;

-- record-attendance steps 4..15 (decisions §D). Steps 1..3 (auth, rate limit, body) and the pure
-- token checks of steps 6..7 run in the Edge Function, which passes their results in so the
-- documented order is still respected. Always returns jsonb; never raises for business errors,
-- so the scan_attempts row of a failure is committed.
create or replace function public.record_scan(
  p_employee_id uuid,
  p_device_hash text,
  p_station_id uuid,
  p_nonce uuid,
  p_token_valid boolean,
  p_token_expired boolean,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_selfie_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set public.app_settings := public.settings();
  v_profile public.profiles;
  v_device_hash text;
  v_station public.stations;
  v_radius int;
  v_distance double precision;
  v_last timestamptz;
  v_punch record;
  v_code text;
  v_reason text;
  v_params jsonb := '{}'::jsonb;
  v_scan_id uuid;
  v_result jsonb;
begin
  -- Step 4: active employee
  select * into v_profile from public.profiles where id = p_employee_id;
  if v_profile.id is null or v_profile.role <> 'employee' or v_profile.status <> 'active' then
    v_code := 'ACCOUNT_NOT_ACTIVE';
    v_reason := 'Profile is ' || coalesce(v_profile.role::text || '/' || v_profile.status::text, 'missing');
  end if;

  -- Step 5: device binding
  if v_code is null then
    select d.device_id_hash into v_device_hash from public.devices d
    where d.employee_id = p_employee_id and d.revoked_at is null;
    if v_device_hash is null then
      v_code := 'DEVICE_NOT_BOUND';
    elsif v_device_hash <> p_device_hash then
      v_code := 'DEVICE_MISMATCH';
      v_reason := 'Scan from a phone that is not the bound device';
    end if;
  end if;

  -- Steps 6-7: signature and expiry (evaluated in the Edge Function)
  if v_code is null and not p_token_valid then
    v_code := 'QR_INVALID';
  end if;
  if v_code is null and p_token_expired then
    v_code := 'QR_EXPIRED';
  end if;

  -- Step 8: nonce issued for this station
  if v_code is null and not exists (
    select 1 from public.qr_nonces n where n.nonce = p_nonce and n.station_id = p_station_id
  ) then
    v_code := 'QR_UNKNOWN';
  end if;

  -- Step 9: nonce not yet used by this employee (D-10)
  if v_code is null and exists (
    select 1 from public.qr_nonce_uses u where u.nonce = p_nonce and u.employee_id = p_employee_id
  ) then
    v_code := 'QR_REUSED';
  end if;

  -- Step 10: station active
  if v_code is null then
    select * into v_station from public.stations where id = p_station_id;
    if v_station.id is null or not v_station.is_active then
      v_code := 'STATION_INACTIVE';
    end if;
  end if;

  -- Step 11: GPS accuracy
  if v_code is null and p_accuracy > v_set.max_gps_accuracy_m then
    v_code := 'GPS_INACCURATE';
    v_params := jsonb_build_object('accuracy', round(p_accuracy), 'max', v_set.max_gps_accuracy_m);
    v_reason := format('GPS accuracy %s m (limit %s m)', round(p_accuracy), v_set.max_gps_accuracy_m);
  end if;

  -- Step 12: geofence
  if v_code is null then
    v_radius := coalesce(v_station.radius_m, v_set.geofence_radius_m);
    v_distance := public.haversine_distance_m(
      p_lat, p_lng, v_station.latitude::double precision, v_station.longitude::double precision);
    if v_distance > v_radius then
      v_code := 'OUTSIDE_GEOFENCE';
      v_params := jsonb_build_object('distance', round(v_distance), 'radius', v_radius);
      v_reason := format('Outside geofence: %s m from %s (limit %s m)',
        round(v_distance), v_station.name, v_radius);
    end if;
  end if;

  -- Step 13: cooldown since last successful scan (D-20, BR-38)
  if v_code is null then
    select max(sa.created_at) into v_last from public.scan_attempts sa
    where sa.employee_id = p_employee_id and sa.success
      and sa.created_at > now() - make_interval(mins => v_set.cooldown_minutes);
    if v_last is not null then
      v_code := 'COOLDOWN_ACTIVE';
      v_params := jsonb_build_object(
        'last_time', to_char(v_last at time zone 'Asia/Manila', 'HH24:MI'),
        'next_time', to_char((v_last + make_interval(mins => v_set.cooldown_minutes))
          at time zone 'Asia/Manila', 'HH24:MI'));
    end if;
  end if;

  -- Step 14: day not already completed
  if v_code is null then
    select * into v_punch from public.resolve_punch(p_employee_id, now());
    if v_punch.action = 'completed' then
      v_code := 'ALREADY_COMPLETED';
    end if;
  end if;

  -- Step 15: selfie when required
  if v_code is null and v_set.selfie_required and p_selfie_path is null then
    v_code := 'SELFIE_REQUIRED';
  end if;

  if v_code is not null then
    perform public.log_scan_attempt(p_employee_id, p_station_id, v_code, v_reason, p_lat, p_lng,
      p_accuracy, p_device_hash, p_nonce, p_selfie_path);
    return jsonb_build_object('ok', false, 'code', v_code, 'params', v_params);
  end if;

  -- Success: mark nonce used (PK enforces single use per employee under concurrency), log the
  -- attempt and write the punch, all in this transaction.
  begin
    insert into public.qr_nonce_uses (nonce, employee_id) values (p_nonce, p_employee_id);
  exception when unique_violation then
    perform public.log_scan_attempt(p_employee_id, p_station_id, 'QR_REUSED', 'Concurrent reuse',
      p_lat, p_lng, p_accuracy, p_device_hash, p_nonce, p_selfie_path);
    return jsonb_build_object('ok', false, 'code', 'QR_REUSED', 'params', '{}'::jsonb);
  end;

  v_scan_id := public.log_scan_attempt(p_employee_id, p_station_id, null, null, p_lat, p_lng,
    p_accuracy, p_device_hash, p_nonce, p_selfie_path);
  v_result := public.apply_punch(p_employee_id, now(), p_station_id, 'qr', p_employee_id, v_scan_id);

  if not (v_result ->> 'ok')::boolean then
    -- Lost a race with a concurrent scan of the same employee: keep the attempt as a failure.
    update public.scan_attempts set success = false, error_code = 'ALREADY_COMPLETED',
      failure_reason = 'Concurrent scan already completed the day'
    where id = v_scan_id;
    return jsonb_build_object('ok', false, 'code', 'ALREADY_COMPLETED', 'params', '{}'::jsonb);
  end if;

  return v_result || jsonb_build_object(
    'stationName', v_station.name,
    'employeeName', v_profile.full_name,
    'scanId', v_scan_id
  );
end;
$$;
revoke all on function public.record_scan(uuid, text, uuid, uuid, boolean, boolean,
  double precision, double precision, double precision, text) from public, anon, authenticated;

-- Fallback personal QR scanned by an admin (core flow 5, FR-63, BR-59). The Edge Function checks
-- the HMAC/expiry and passes the result.
create or replace function public.record_fallback_scan(
  p_admin_id uuid,
  p_employee_id uuid,
  p_station_id uuid,
  p_nonce uuid,
  p_token_valid boolean,
  p_token_expired boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set public.app_settings := public.settings();
  v_profile public.profiles;
  v_station public.stations;
  v_last timestamptz;
  v_code text;
  v_params jsonb := '{}'::jsonb;
  v_scan_id uuid;
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles p
                 where p.id = p_admin_id and p.role = 'admin' and p.status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not p_token_valid then
    v_code := 'QR_INVALID';
  elsif p_token_expired then
    v_code := 'QR_EXPIRED';
  end if;

  if v_code is null then
    select * into v_profile from public.profiles where id = p_employee_id;
    if v_profile.id is null or v_profile.role <> 'employee' or v_profile.status <> 'active' then
      v_code := 'ACCOUNT_NOT_ACTIVE';
    end if;
  end if;

  if v_code is null and exists (
    select 1 from public.qr_nonce_uses u where u.nonce = p_nonce and u.employee_id = p_employee_id
  ) then
    v_code := 'QR_REUSED';
  end if;

  if v_code is null then
    select * into v_station from public.stations where id = p_station_id;
    if v_station.id is null or not v_station.is_active then
      v_code := 'STATION_INACTIVE';
    end if;
  end if;

  if v_code is null then
    select max(sa.created_at) into v_last from public.scan_attempts sa
    where sa.employee_id = p_employee_id and sa.success
      and sa.created_at > now() - make_interval(mins => v_set.cooldown_minutes);
    if v_last is not null then
      v_code := 'COOLDOWN_ACTIVE';
      v_params := jsonb_build_object(
        'last_time', to_char(v_last at time zone 'Asia/Manila', 'HH24:MI'),
        'next_time', to_char((v_last + make_interval(mins => v_set.cooldown_minutes))
          at time zone 'Asia/Manila', 'HH24:MI'));
    end if;
  end if;

  if v_code is null and (select r.action from public.resolve_punch(p_employee_id, now()) r) = 'completed' then
    v_code := 'ALREADY_COMPLETED';
  end if;

  if v_code is not null then
    if v_code <> 'FORBIDDEN' then
      perform public.log_scan_attempt(
        case when v_profile.id is not null then p_employee_id end, p_station_id, v_code,
        'Fallback personal QR scanned by admin', null, null, null, null, p_nonce, null);
    end if;
    return jsonb_build_object('ok', false, 'code', v_code, 'params', v_params);
  end if;

  insert into public.qr_nonce_uses (nonce, employee_id) values (p_nonce, p_employee_id);
  v_scan_id := public.log_scan_attempt(p_employee_id, p_station_id, null, null, null, null, null,
    null, p_nonce, null);
  v_result := public.apply_punch(p_employee_id, now(), p_station_id, 'fallback_personal_qr',
    p_admin_id, v_scan_id, 'Fallback: personal QR scanned by admin');

  return v_result || jsonb_build_object(
    'stationName', v_station.name, 'employeeName', v_profile.full_name, 'scanId', v_scan_id);
end;
$$;
revoke all on function public.record_fallback_scan(uuid, uuid, uuid, uuid, boolean, boolean)
  from public, anon, authenticated;

-- device-sync: one event from a future fingerprint terminal (FR-116, FR-117). Idempotent on
-- (employee, event id) through scan_attempts.nonce. Station = the terminal's stations row.
create or replace function public.record_device_sync_event(
  p_station_id uuid,
  p_bhw_id_number text,
  p_event_id uuid,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_station public.stations;
  v_existing public.scan_attempts;
  v_scan_id uuid;
  v_result jsonb;
  v_at timestamptz;
begin
  select * into v_station from public.stations where id = p_station_id;
  if v_station.id is null or not v_station.is_active then
    return jsonb_build_object('status', 'rejected', 'code', 'STATION_INACTIVE');
  end if;

  select * into v_profile from public.profiles
  where upper(bhw_id_number) = upper(btrim(p_bhw_id_number));
  if v_profile.id is null or v_profile.role <> 'employee' or v_profile.status <> 'active' then
    return jsonb_build_object('status', 'rejected', 'code', 'ACCOUNT_NOT_ACTIVE');
  end if;

  select * into v_existing from public.scan_attempts sa
  where sa.employee_id = v_profile.id and sa.nonce = p_event_id
  order by sa.created_at limit 1;
  if v_existing.id is not null then
    return jsonb_build_object('status', 'duplicate', 'code', v_existing.error_code);
  end if;

  -- Terminal clocks are not trusted for live events (BR-02): within ±5 minutes the server time
  -- is used; older events are accepted as backfill with their own time and flagged in notes.
  v_at := case when abs(extract(epoch from now() - p_occurred_at)) <= 300 then now()
               else p_occurred_at end;
  if v_at > now() then
    return jsonb_build_object('status', 'rejected', 'code', 'FUTURE_TIME_NOT_ALLOWED');
  end if;

  v_scan_id := public.log_scan_attempt(v_profile.id, p_station_id, null, null, null, null, null,
    null, p_event_id, null);
  v_result := public.apply_punch(v_profile.id, v_at, p_station_id, 'qr', v_profile.id, v_scan_id,
    'device-sync: ' || v_station.name || case when v_at <> now() then ' (backfill)' else '' end);

  if not (v_result ->> 'ok')::boolean then
    update public.scan_attempts set success = false, error_code = 'ALREADY_COMPLETED'
    where id = v_scan_id;
    return jsonb_build_object('status', 'rejected', 'code', 'ALREADY_COMPLETED');
  end if;
  return jsonb_build_object('status', 'recorded', 'action', v_result ->> 'action');
end;
$$;
revoke all on function public.record_device_sync_event(uuid, text, uuid, timestamptz)
  from public, anon, authenticated;

-- Kiosk token issue bookkeeping (called by issue-qr-token with the service role).
create or replace function public.register_qr_nonce(
  p_kiosk_user uuid, p_station_id uuid, p_nonce uuid, p_lifetime_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_station public.stations;
  v_now timestamptz := now();
begin
  select * into v_station from public.stations where id = p_station_id;
  if v_station.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_station.kiosk_user_id is distinct from p_kiosk_user and not exists (
    select 1 from public.profiles p where p.id = p_kiosk_user and p.role = 'admin' and p.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not v_station.is_active then
    return jsonb_build_object('ok', false, 'code', 'STATION_INACTIVE');
  end if;
  insert into public.qr_nonces (nonce, station_id, issued_at, expires_at)
  values (p_nonce, p_station_id, v_now, v_now + make_interval(secs => p_lifetime_seconds));
  return jsonb_build_object(
    'ok', true, 'issuedAt', v_now, 'expiresAt', v_now + make_interval(secs => p_lifetime_seconds),
    'stationName', v_station.name);
end;
$$;
revoke all on function public.register_qr_nonce(uuid, uuid, uuid, int) from public, anon, authenticated;

-- Kiosk heartbeat (FR-109, FR-119, D-34).
create or replace function public.record_heartbeat(
  p_kiosk_user uuid, p_station_id uuid, p_app_version text, p_client_now_ms bigint,
  p_last_token_at_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_station public.stations;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_drift int;
begin
  select * into v_station from public.stations where id = p_station_id;
  if v_station.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_station.kiosk_user_id is distinct from p_kiosk_user then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  v_drift := greatest(least(p_client_now_ms - v_now_ms, 2147483647), -2147483647)::int;
  insert into public.kiosk_heartbeats (station_id, app_version, clock_drift_ms, last_token_at)
  values (p_station_id, left(p_app_version, 20), v_drift,
          case when p_last_token_at_ms is null then null else to_timestamp(p_last_token_at_ms / 1000.0) end);
  update public.stations set last_seen_at = now(), is_online = true where id = p_station_id;
  return jsonb_build_object('ok', true, 'serverNow', v_now_ms, 'clockDriftMs', v_drift,
    'driftWarning', abs(v_drift) > 30000);
end;
$$;
revoke all on function public.record_heartbeat(uuid, uuid, text, bigint, bigint) from public, anon, authenticated;

-- Device binding (core flow 2, FR-27..FR-31, D-05..D-07).
create or replace function public.bind_device(
  p_employee_id uuid, p_device_hash text, p_platform public.device_platform, p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_current public.devices;
begin
  select * into v_profile from public.profiles where id = p_employee_id;
  if v_profile.id is null or v_profile.role <> 'employee' or v_profile.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE',
      'status', coalesce(v_profile.status::text, 'missing'));
  end if;

  select * into v_current from public.devices
  where employee_id = p_employee_id and revoked_at is null;
  if v_current.id is not null then
    if v_current.device_id_hash = p_device_hash then
      return jsonb_build_object('ok', true, 'alreadyBound', true, 'boundAt', v_current.bound_at);
    end if;
    return jsonb_build_object('ok', false, 'code', 'DEVICE_MISMATCH');
  end if;

  if exists (select 1 from public.devices d where d.device_id_hash = p_device_hash and d.revoked_at is null) then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_MISMATCH');
  end if;

  perform public.set_audit_context('bind_device', p_employee_id);
  insert into public.devices (employee_id, device_id_hash, platform, model)
  values (p_employee_id, p_device_hash, p_platform, left(p_model, 100))
  returning * into v_current;
  return jsonb_build_object('ok', true, 'alreadyBound', false, 'boundAt', v_current.bound_at);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'DEVICE_MISMATCH');
end;
$$;
revoke all on function public.bind_device(uuid, text, public.device_platform, text) from public, anon, authenticated;

-- Device check used by issue-personal-qr and the mobile pre-scan health check.
create or replace function public.check_device(p_employee_id uuid, p_device_hash text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_active_employee(p_employee_id) then 'ACCOUNT_NOT_ACTIVE'
    when not exists (select 1 from public.devices d where d.employee_id = p_employee_id and d.revoked_at is null)
      then 'DEVICE_NOT_BOUND'
    when not exists (select 1 from public.devices d where d.employee_id = p_employee_id
                     and d.revoked_at is null and d.device_id_hash = p_device_hash)
      then 'DEVICE_MISMATCH'
    else null
  end;
$$;
revoke all on function public.check_device(uuid, text) from public, anon, authenticated;
