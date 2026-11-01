-- =============================================================================
-- LOCAL / DEMO SEED ONLY – never run in production (see docs/phase-6 production bootstrap).
-- Accounts (password for all: BhwDemo#2026):
--   admin@bhw.local   (admin)      kiosk@bhw.local  (kiosk, station "BHW Office – Main Entrance")
--   viewer@bhw.local  (viewer)     8 BHWs: <first>.<last>@bhw.local (employee, active)
-- Station: Barangay Kalawag II BHW Office, Isulan, Sultan Kudarat (6.6311, 124.6047), 100 m.
-- Schedule: Mon–Fri 08:00–17:00, break 12:00–13:00, 15-minute grace.
-- Attendance: the two full Mon–Fri weeks before the current week, with late, absent,
-- undertime and incomplete (no time-out) cases. Dates are relative so the seed stays current.
-- =============================================================================

-- Dev-only encryption key for contact number / address (D-29). Production: create in Vault manually.
select vault.create_secret('dev-only-profile-key-change-me-0123456789abcdef', 'profile_encryption_key');

do $$
declare
  v_pw text := extensions.crypt('BhwDemo#2026', extensions.gen_salt('bf'));
  v_admin uuid := '00000000-0000-4000-a000-000000000001';
  v_kiosk uuid := '00000000-0000-4000-a000-000000000002';
  v_viewer uuid := '00000000-0000-4000-a000-000000000003';
  v_station uuid := '10000000-0000-4000-a000-000000000001';
  v_schedule uuid := '20000000-0000-4000-a000-000000000001';
  v_bhw record;
  v_users jsonb := '[
    {"id":"30000000-0000-4000-a000-000000000001","name":"Maria Luz D. Santos","email":"maria.santos@bhw.local","bhw":"BHW-KII-2019-001","area":"Purok Malipayon","phone":"09171234501"},
    {"id":"30000000-0000-4000-a000-000000000002","name":"Rowena P. Dela Cruz","email":"rowena.delacruz@bhw.local","bhw":"BHW-KII-2019-002","area":"Purok Bagong Silang","phone":"09171234502"},
    {"id":"30000000-0000-4000-a000-000000000003","name":"Norhaya K. Mamalinta","email":"norhaya.mamalinta@bhw.local","bhw":"BHW-KII-2020-003","area":"Purok Masagana","phone":"09171234503"},
    {"id":"30000000-0000-4000-a000-000000000004","name":"Josefina A. Villanueva","email":"josefina.villanueva@bhw.local","bhw":"BHW-KII-2020-004","area":"Purok Kalinaw","phone":"09171234504"},
    {"id":"30000000-0000-4000-a000-000000000005","name":"Analyn M. Garcia","email":"analyn.garcia@bhw.local","bhw":"BHW-KII-2021-005","area":"Purok Mabuhay","phone":"09171234505"},
    {"id":"30000000-0000-4000-a000-000000000006","name":"Cristina B. Reyes","email":"cristina.reyes@bhw.local","bhw":"BHW-KII-2021-006","area":"Purok Malipayon","phone":"09171234506"},
    {"id":"30000000-0000-4000-a000-000000000007","name":"Fatima S. Abdullah","email":"fatima.abdullah@bhw.local","bhw":"BHW-KII-2022-007","area":"Purok Masagana","phone":"09171234507"},
    {"id":"30000000-0000-4000-a000-000000000008","name":"Lorna T. Bautista","email":"lorna.bautista@bhw.local","bhw":"BHW-KII-2023-008","area":"Purok Bagong Silang","phone":"09171234508"}
  ]';
  v_week_start date := (public.manila_today() - ((extract(isodow from public.manila_today())::int - 1) + 14));
  v_day date;
  v_roll int;
  v_in time;
  v_out time;
  v_in_ts timestamptz;
  v_out_ts timestamptz;
  v_c record;
  v_idx int := 0;
begin
  -- Staff accounts (role from raw_app_meta_data -> handle_new_user creates them active).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
     'admin@bhw.local', v_pw, now(), '{"provider":"email","providers":["email"],"role":"admin"}',
     '{"full_name":"Janine A. Raganas"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_kiosk, 'authenticated', 'authenticated',
     'kiosk@bhw.local', v_pw, now(), '{"provider":"email","providers":["email"],"role":"kiosk"}',
     '{"full_name":"Kiosk – Main Entrance"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_viewer, 'authenticated', 'authenticated',
     'viewer@bhw.local', v_pw, now(), '{"provider":"email","providers":["email"],"role":"viewer"}',
     '{"full_name":"Hon. Ricardo L. Mendoza"}', now(), now(), '', '', '', '');

  -- BHW self-registrations (handle_new_user encrypts the phone and creates pending profiles).
  for v_bhw in select * from jsonb_to_recordset(v_users)
      as x(id uuid, name text, email text, bhw text, area text, phone text) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_bhw.id, 'authenticated', 'authenticated',
      v_bhw.email, v_pw, now() - interval '60 days', '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_bhw.name, 'bhw_id_number', v_bhw.bhw, 'area', v_bhw.area,
        'contact_number', v_bhw.phone, 'address', v_bhw.area || ', Brgy. Kalawag II, Isulan, Sultan Kudarat',
        'consent', true),
      now() - interval '60 days', now(), '', '', '', '');
  end loop;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u
  where u.email like '%@bhw.local';

  -- Station + kiosk link, schedule, holidays.
  insert into public.stations (id, name, latitude, longitude, radius_m, kiosk_user_id, last_seen_at, is_online)
  values (v_station, 'BHW Office – Main Entrance', 6.631100, 124.604700, null, v_kiosk, now(), true);

  insert into public.schedules (id, name, work_days, start_time, end_time, grace_minutes, break_start,
    break_end, created_by)
  values (v_schedule, 'Regular Mon–Fri 08:00–17:00', array[1, 2, 3, 4, 5], '08:00', '17:00', 15,
    '12:00', '13:00', v_admin);

  insert into public.holidays (date, name) values
    (make_date(extract(year from public.manila_today())::int, 11, 1), 'All Saints'' Day'),
    (make_date(extract(year from public.manila_today())::int, 11, 30), 'Bonifacio Day');

  -- Approve all BHWs with the regular schedule effective 60 days ago.
  update public.profiles
  set status = 'active', approved_by = v_admin, approved_at = now() - interval '59 days'
  where role = 'employee';
  insert into public.employee_schedules (employee_id, schedule_id, effective_from)
  select p.id, v_schedule, public.manila_today() - 59 from public.profiles p where p.role = 'employee';

  -- Bind phones for the first six BHWs (two still need to log in on the app).
  insert into public.devices (employee_id, device_id_hash, platform, model, bound_at)
  select p.id, encode(extensions.digest('seed-device-' || p.id::text, 'sha256'), 'hex'), 'android',
         (array['Samsung Galaxy A15', 'Xiaomi Redmi 13C', 'realme C67', 'vivo Y28', 'OPPO A18', 'Infinix Hot 40'])[n],
         now() - interval '55 days'
  from (select id, row_number() over (order by bhw_id_number) n from public.profiles where role = 'employee') p
  where p.n <= 6;

  -- Two weeks of attendance (Mon–Fri) with deterministic variety per employee/day.
  for v_bhw in select p.id, p.bhw_id_number from public.profiles p where p.role = 'employee'
               order by p.bhw_id_number loop
    v_idx := v_idx + 1;
    for v_day in select d::date from generate_series(v_week_start, v_week_start + 11, interval '1 day') d loop
      continue when extract(isodow from v_day) > 5;
      continue when exists (select 1 from public.holidays h where h.date = v_day);
      v_roll := abs(hashtext(v_bhw.id::text || v_day::text)::bigint)::int % 100;

      if v_roll < 7 then
        insert into public.attendance_records (employee_id, work_date, status, method)
        values (v_bhw.id, v_day, 'absent', 'qr');
        continue;
      end if;

      v_in := case
        when v_roll < 22 then time '08:16' + make_interval(mins => v_roll)         -- late
        else time '07:35' + make_interval(mins => (v_roll * 7) % 40) end;          -- on time
      v_out := case
        when v_roll between 22 and 26 then null                                    -- forgot time-out
        when v_roll between 27 and 33 then time '16:05' + make_interval(mins => v_roll) -- undertime
        else time '17:00' + make_interval(mins => (v_roll * 3) % 35) end;

      v_in_ts := public.manila_ts(v_day, v_in) + make_interval(secs => v_roll % 50);
      v_out_ts := case when v_out is null then null
                       else public.manila_ts(v_day, v_out) + make_interval(secs => v_roll % 45) end;
      select * into v_c from public.compute_attendance_status(v_bhw.id, v_day, v_in_ts, v_out_ts, true);

      insert into public.attendance_records (employee_id, work_date, time_in, time_out, station_id,
        status, minutes_late, undertime_minutes, method, created_by)
      values (v_bhw.id, v_day, v_in_ts, v_out_ts, v_station, v_c.status, v_c.minutes_late,
        v_c.undertime_minutes, 'qr', v_bhw.id);

      insert into public.scan_attempts (employee_id, station_id, success, lat, lng, accuracy, created_at)
      values (v_bhw.id, v_station, true, 6.631120, 124.604730, 8 + v_roll % 20, v_in_ts);
      if v_out_ts is not null then
        insert into public.scan_attempts (employee_id, station_id, success, lat, lng, accuracy, created_at)
        values (v_bhw.id, v_station, true, 6.631090, 124.604690, 6 + v_roll % 15, v_out_ts);
      end if;
    end loop;
  end loop;

  -- A few failed attempts for the Device Health / anomaly pages.
  insert into public.scan_attempts (employee_id, station_id, success, error_code, failure_reason, lat, lng, accuracy, created_at)
  values
    ('30000000-0000-4000-a000-000000000002', v_station, false, 'OUTSIDE_GEOFENCE',
     'Outside geofence: 312 m from BHW Office – Main Entrance (limit 100 m)', 6.633900, 124.604700, 15,
     public.manila_ts(v_week_start + 8, '07:58')),
    ('30000000-0000-4000-a000-000000000005', v_station, false, 'QR_EXPIRED', null, 6.631100, 124.604710, 9,
     public.manila_ts(v_week_start + 3, '08:02')),
    ('30000000-0000-4000-a000-000000000007', v_station, false, 'GPS_INACCURATE',
     'GPS accuracy 85 m (limit 50 m)', 6.631300, 124.604400, 85, public.manila_ts(v_week_start + 1, '07:49'));

  -- One pending and one approved correction request, plus an error log sample.
  insert into public.correction_requests (employee_id, work_date, type, requested_time_out, reason, created_at)
  select ar.employee_id, ar.work_date, 'missing_time_out', public.manila_ts(ar.work_date, '17:05'),
         'Forgot to scan out after the house-to-house deworming visit in our purok.', now() - interval '1 day'
  from public.attendance_records ar
  where ar.status = 'incomplete' and ar.work_date >= date_trunc('month', public.manila_today())
  order by ar.work_date desc limit 1;

  insert into public.error_logs (source, severity, message, context)
  values ('mobile', 'warning', 'Camera permission denied on first scan',
    '{"screen":"scan","platform":"android","app_version":"1.0.0"}');
end;
$$;
