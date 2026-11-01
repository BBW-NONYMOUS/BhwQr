-- record_scan validation order (decisions §D steps 4..15) and time-in/time-out writes.
begin;
select plan(22);

select tests.make_employee('40000000-0000-4000-a000-000000000001', 'BHW-TEST-001');
select tests.make_employee('40000000-0000-4000-a000-000000000002', 'BHW-TEST-002');

create temp table k as select
  '10000000-0000-4000-a000-000000000001'::uuid as station,
  '40000000-0000-4000-a000-000000000001'::uuid as emp,
  (repeat('b', 63) || '1') as hash,
  gen_random_uuid() as nonce;
insert into public.qr_nonces (nonce, station_id, issued_at, expires_at)
select nonce, station, now(), now() + interval '30 seconds' from k;

create or replace function pg_temp.scan(p_hash text, p_nonce uuid, p_valid boolean, p_expired boolean,
  p_lat float8, p_lng float8, p_acc float8, p_emp uuid default '40000000-0000-4000-a000-000000000001')
returns text language sql as $$
  select coalesce(r ->> 'code', r ->> 'action') from (select public.record_scan(
    p_emp, p_hash, '10000000-0000-4000-a000-000000000001', p_nonce, p_valid, p_expired,
    p_lat, p_lng, p_acc, null) r) x;
$$;

-- Step 4
select is(pg_temp.scan((select hash from k), (select nonce from k), true, false, 6.6311, 124.6047, 10,
  '00000000-0000-4000-a000-000000000003'), 'ACCOUNT_NOT_ACTIVE', 'viewer cannot scan (step 4)');
update public.profiles set status = 'inactive' where id = '40000000-0000-4000-a000-000000000002';
select is(pg_temp.scan(repeat('b', 63) || '2', (select nonce from k), true, false, 6.6311, 124.6047, 10,
  '40000000-0000-4000-a000-000000000002'), 'ACCOUNT_NOT_ACTIVE', 'inactive employee cannot scan (AC-01)');
-- Step 5
select is(pg_temp.scan(repeat('c', 64), (select nonce from k), true, false, 6.6311, 124.6047, 10),
  'DEVICE_MISMATCH', 'another phone is rejected (step 5)');
-- Steps 6, 7
select is(pg_temp.scan((select hash from k), (select nonce from k), false, false, 6.6311, 124.6047, 10),
  'QR_INVALID', 'bad signature is rejected (step 6)');
select is(pg_temp.scan((select hash from k), (select nonce from k), true, true, 6.6311, 124.6047, 10),
  'QR_EXPIRED', 'expired token is rejected (step 7, AC-02)');
-- Step 8
select is(pg_temp.scan((select hash from k), gen_random_uuid(), true, false, 6.6311, 124.6047, 10),
  'QR_UNKNOWN', 'nonce not issued by the kiosk is rejected (step 8)');
-- Step 11
select is(pg_temp.scan((select hash from k), (select nonce from k), true, false, 6.6311, 124.6047, 85),
  'GPS_INACCURATE', 'poor GPS accuracy is rejected (step 11)');
-- Step 12 (~330 m north)
select is(pg_temp.scan((select hash from k), (select nonce from k), true, false, 6.6341, 124.6047, 10),
  'OUTSIDE_GEOFENCE', 'outside the 100 m geofence is rejected (step 12, AC-04)');
select is((select r -> 'params' ->> 'radius' from (select public.record_scan(
  (select emp from k), (select hash from k), (select station from k), (select nonce from k), true, false,
  6.6341, 124.6047, 10, null) r) x), '100', 'geofence error carries radius for the message');

-- Success: time-in
select is(pg_temp.scan((select hash from k), (select nonce from k), true, false, 6.6312, 124.6046, 10),
  'time_in', 'valid scan records time-in');
select is((select count(*)::int from public.attendance_records
  where employee_id = (select emp from k) and time_in is not null and method = 'qr'), 1, 'one record written');
select is((select count(*)::int from public.qr_nonce_uses where employee_id = (select emp from k)), 1, 'nonce marked used');
-- Step 9: reuse
select is(pg_temp.scan((select hash from k), (select nonce from k), true, false, 6.6312, 124.6046, 10),
  'QR_REUSED', 'same QR cannot be used twice by the same user (step 9, AC-03)');
-- Step 13: cooldown with a fresh nonce
insert into public.qr_nonces (nonce, station_id, issued_at, expires_at)
values ('50000000-0000-4000-a000-000000000001', (select station from k), now(), now() + interval '30 seconds');
select is(pg_temp.scan((select hash from k), '50000000-0000-4000-a000-000000000001', true, false, 6.6312, 124.6046, 10),
  'COOLDOWN_ACTIVE', 'second scan within 5 minutes hits the cooldown (step 13)');

-- Time-out after the cooldown: move the first scan 10 minutes into the past.
update public.scan_attempts set created_at = created_at - interval '10 minutes'
where employee_id = (select emp from k) and success;
update public.attendance_records set time_in = time_in - interval '10 minutes'
where employee_id = (select emp from k);
select is(pg_temp.scan((select hash from k), '50000000-0000-4000-a000-000000000001', true, false, 6.6312, 124.6046, 10),
  'time_out', 'scan after the cooldown records time-out');
select ok((select time_out > time_in from public.attendance_records where employee_id = (select emp from k)),
  'time-out is after time-in');

-- Step 14: day completed
update public.scan_attempts set created_at = created_at - interval '10 minutes'
where employee_id = (select emp from k) and success;
insert into public.qr_nonces (nonce, station_id, issued_at, expires_at)
values ('50000000-0000-4000-a000-000000000002', (select station from k), now(), now() + interval '30 seconds');
select is(pg_temp.scan((select hash from k), '50000000-0000-4000-a000-000000000002', true, false, 6.6312, 124.6046, 10),
  'ALREADY_COMPLETED', 'third scan of the day is rejected (step 14)');

-- Step 10 and 15
update public.app_settings set selfie_required = true where id = 1;
update public.scan_attempts set created_at = created_at - interval '10 minutes' where employee_id = (select emp from k);
delete from public.attendance_records where employee_id = (select emp from k);
insert into public.qr_nonces (nonce, station_id, issued_at, expires_at)
values ('50000000-0000-4000-a000-000000000003', (select station from k), now(), now() + interval '30 seconds');
select is(pg_temp.scan((select hash from k), '50000000-0000-4000-a000-000000000003', true, false, 6.6312, 124.6046, 10),
  'SELFIE_REQUIRED', 'selfie required when the setting is on (step 15)');
update public.app_settings set selfie_required = false where id = 1;
update public.stations set is_active = false where id = (select station from k);
select is(pg_temp.scan((select hash from k), '50000000-0000-4000-a000-000000000003', true, false, 6.6312, 124.6046, 10),
  'STATION_INACTIVE', 'inactive station is rejected (step 10)');
update public.stations set is_active = true where id = (select station from k);

-- Every attempt is logged (success and failure)
select ok((select count(*) from public.scan_attempts where employee_id = (select emp from k) and not success) >= 9,
  'failed attempts are logged in scan_attempts');
select is((select count(*)::int from public.scan_attempts where employee_id = (select emp from k) and success), 2,
  'successful attempts are logged in scan_attempts');

-- Device not bound after admin reset
update public.devices set revoked_at = now() where employee_id = (select emp from k);
select is(pg_temp.scan((select hash from k), '50000000-0000-4000-a000-000000000003', true, false, 6.6312, 124.6046, 10),
  'DEVICE_NOT_BOUND', 'after a device reset the phone must bind again (step 5)');

select * from finish();
rollback;
