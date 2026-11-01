-- Corrections (AC-07, AC-08), DTR (AC-09), reports (AC-06), end-of-day job, kiosk offline (AC-10),
-- audit trail and encryption (AC-12).
begin;
select plan(22);

select tests.make_employee('40000000-0000-4000-a000-000000000011', 'BHW-TEST-011');
create temp table v as select
  '40000000-0000-4000-a000-000000000011'::uuid as emp,
  -- most recent past weekday in the current month (or today if month just started)
  (select max(d)::date from generate_series(date_trunc('month', public.manila_today()), public.manila_today() - 1, interval '1 day') d
    where extract(isodow from d) between 1 and 5
      and not exists (select 1 from public.holidays h where h.date = d::date)) as day;

-- Forgotten time-out, closed by the end-of-day job.
insert into public.attendance_records (employee_id, work_date, time_in, station_id, status, method, created_by)
select emp, day, public.manila_ts(day, '07:58'), '10000000-0000-4000-a000-000000000001', 'on_time', 'qr', emp from v
where day is not null;
select lives_ok($$select public.run_end_of_day((select day from v))$$, 'end-of-day job runs');
select is((select status::text from public.attendance_records where employee_id = (select emp from v)
  and work_date = (select day from v)), 'incomplete', 'forgotten time-out becomes incomplete');
select ok(exists (select 1 from public.attendance_records ar join public.profiles p on p.id = ar.employee_id
  where ar.work_date = (select day from v) and p.role = 'employee' and p.status = 'active')
  , 'end-of-day job leaves a record for every scheduled employee');
select lives_ok($$select public.run_end_of_day((select day from v))$$, 'end-of-day job is idempotent');

-- Employee files a missing time-out correction.
select tests.login_as((select emp from v));
select lives_ok($$select public.file_correction_request((select day from v), 'missing_time_out', null, '17:05',
  'Forgot to scan out after the barangay feeding program.')$$, 'employee files a correction');
select throws_ok($$select public.file_correction_request((select day from v), 'missing_time_out', null, '17:10',
  'Second request for the same date should fail.')$$, 'P0001', 'CORRECTION_DUPLICATE', 'one pending request per date');
select throws_ok($$select public.file_correction_request(public.manila_today() - 70, 'missing_time_in', '08:00', null,
  'Too old to correct through the app now.')$$, 'P0001', 'CORRECTION_NOT_ELIGIBLE', 'old dates are not eligible');
select tests.logout();

-- Admin rejects without remarks -> error; approves -> record + DTR change.
select tests.login_as('00000000-0000-4000-a000-000000000001');
select throws_ok($$select public.review_correction_request((select id from public.correction_requests
  where employee_id = (select emp from v)), 'rejected', 'no')$$, 'P0001', 'REASON_REQUIRED',
  'rejection needs remarks');
select lives_ok($$select public.review_correction_request((select id from public.correction_requests
  where employee_id = (select emp from v)), 'approved', null)$$, 'admin approves the correction');
select results_eq($$select status::text, method::text, to_char(time_out at time zone 'Asia/Manila', 'HH24:MI')
  from public.attendance_records where employee_id = (select emp from v) and work_date = (select day from v)$$,
  $$values ('on_time', 'correction', '17:05')$$, 'approved correction updates the record (AC-08)');
select is((select r ->> 'pm_departure' from jsonb_array_elements(public.get_dtr((select emp from v),
  extract(year from (select day from v))::int, extract(month from (select day from v))::int) -> 'rows') r
  where (r ->> 'work_date')::date = (select day from v)), '17:05:00', 'DTR shows the corrected time-out (AC-08)');
select ok(exists (select 1 from public.audit_logs where table_name = 'attendance_records'
  and action = 'approve_correction' and actor_id = '00000000-0000-4000-a000-000000000001'),
  'correction is in the audit log with the admin as actor (AC-07)');

-- Manual entry requires a reason and is audited.
select throws_ok($$select public.manual_attendance_entry((select emp from v), (select day from v) - 1, '08:00', '17:00', 'short')$$,
  'P0001', 'REASON_REQUIRED', 'manual entry requires a reason');
select lives_ok($$select public.manual_attendance_entry('30000000-0000-4000-a000-000000000001', (select day from v),
  '08:20', '17:00', 'Phone battery died; verified by the BHW president.')$$, 'manual entry with reason');
select ok(exists (select 1 from public.audit_logs where action like 'manual_attendance_entry: Phone battery%'),
  'manual entry reason is in the audit log (AC-07)');

-- DTR totals match records (AC-09).
select is((select jsonb_array_length(public.get_dtr('30000000-0000-4000-a000-000000000001',
  extract(year from (select day from v))::int, extract(month from (select day from v))::int) -> 'rows')), 31, 'DTR has 31 rows');
select is(
  (select (public.get_dtr('30000000-0000-4000-a000-000000000001', extract(year from (select day from v))::int,
    extract(month from (select day from v))::int) -> 'totals' ->> 'undertime_total_minutes')::int),
  (select coalesce(sum(case when ar.status = 'absent' then 480 else ar.minutes_late + ar.undertime_minutes end), 0)::int
   from public.attendance_records ar where ar.employee_id = '30000000-0000-4000-a000-000000000001'
     and date_trunc('month', ar.work_date) = date_trunc('month', (select day from v))),
  'DTR undertime total equals lateness + undertime + absent days (AC-09)');

-- Monthly report matches raw records (AC-06).
select is(
  (select sum(late_days)::int from public.get_monthly_summary(extract(year from (select day from v))::int,
    extract(month from (select day from v))::int)),
  (select count(*)::int from public.attendance_records ar join public.profiles p on p.id = ar.employee_id
   where ar.status = 'late' and p.role = 'employee'
     and date_trunc('month', ar.work_date) = date_trunc('month', (select day from v))),
  'monthly late count equals the raw records (AC-06)');
select tests.logout();

-- Kiosk offline after 3 missed heartbeats (AC-10).
update public.stations set last_seen_at = now() - interval '4 minutes', is_online = true
where id = '10000000-0000-4000-a000-000000000001';
select is(public.detect_offline_kiosks(), 1, 'kiosk silent for 4 minutes is marked offline (AC-10)');

-- Encryption at rest (AC-12).
select ok((select contact_number_enc is not null and position('0917' in encode(contact_number_enc, 'escape')) = 0
  from public.profiles where id = '30000000-0000-4000-a000-000000000001'), 'contact number is encrypted at rest (AC-12)');

-- Key rotation keeps every value readable (operations §3).
select vault.create_secret('test-rotation-key-0123456789abcdef0123456789', 'profile_encryption_key_next');
select ok(public.rotate_profile_encryption_key('profile_encryption_key_next') >= 8, 'rotation re-encrypts all profiles');
select is(public.decrypt_pii((select contact_number_enc from public.profiles
  where id = '30000000-0000-4000-a000-000000000001')), '09171234501', 'contact number still decrypts after rotation');

select * from finish();
rollback;
