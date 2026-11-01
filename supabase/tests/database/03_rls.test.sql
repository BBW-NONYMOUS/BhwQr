-- Row Level Security per role (FR-137..FR-141, access matrix).
begin;
select plan(22);

-- anon -----------------------------------------------------------------------
set local role anon;
select throws_ok('select count(*) from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select count(*) from public.attendance_records', '42501', null, 'anon cannot read attendance');
select lives_ok($$select public.check_registration_available('BHW-NEW-1', 'new@x.local')$$,
  'anon may run the registration pre-check');
reset role;

-- employee (Maria) -----------------------------------------------------------
select tests.login_as('30000000-0000-4000-a000-000000000001');
select is((select count(*)::int from public.profiles), 1, 'employee sees only own profile');
select is((select count(*)::int from public.attendance_records
  where employee_id <> '30000000-0000-4000-a000-000000000001'), 0, 'employee sees no other attendance');
select ok((select count(*) from public.attendance_records) > 0, 'employee sees own attendance');
select throws_ok($$insert into public.attendance_records (employee_id, work_date, time_in, status, method, station_id)
  values ('30000000-0000-4000-a000-000000000001', '2020-01-06', now(), 'on_time', 'qr', '10000000-0000-4000-a000-000000000001')$$,
  '42501', null, 'employee cannot insert attendance directly (FR-61)');
select throws_ok($$update public.profiles set status = 'active' where id = auth.uid()$$,
  '42501', null, 'employee cannot change own status');
update public.attendance_records set notes = 'hacked' where employee_id = auth.uid();
select is((select count(*)::int from public.attendance_records where notes = 'hacked'), 0,
  'employee cannot update attendance');
select is((select count(*)::int from public.audit_logs), 0, 'employee cannot read audit logs');
select throws_ok($$select * from public.get_daily_summary(public.manila_today())$$, '42501', 'FORBIDDEN',
  'employee cannot run reports');
select throws_ok($$select public.get_dtr('30000000-0000-4000-a000-000000000002', 2026, 10)$$, '42501', 'FORBIDDEN',
  'employee cannot read another DTR');
select lives_ok($$select public.get_dtr(auth.uid(), extract(year from now())::int, extract(month from now())::int)$$,
  'employee reads own DTR');
select throws_ok($$select * from public.get_profile_private('30000000-0000-4000-a000-000000000002')$$, '42501', 'FORBIDDEN',
  'employee cannot decrypt another contact number');
select is((select contact_number from public.get_profile_private(auth.uid())), '09171234501',
  'employee decrypts own contact number');
select throws_ok($$select public.approve_employee('30000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001')$$,
  '42501', 'FORBIDDEN', 'employee cannot call admin RPCs');
select tests.logout();

-- viewer ---------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-a000-000000000003');
select is((select count(*)::int from public.attendance_records), 0, 'viewer has no direct attendance access');
select ok((select count(*) from public.get_daily_summary(public.manila_today())) = 8,
  'viewer reads the daily report through the RPC');
select tests.logout();

-- kiosk ----------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-a000-000000000002');
select is((select count(*)::int from public.stations), 1, 'kiosk sees its own station');
select is((select count(*)::int from public.profiles), 1, 'kiosk sees only its own profile');
select tests.logout();

-- admin ----------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-a000-000000000001');
select is((select count(*)::int from public.profiles where role = 'employee'), 8, 'admin sees all employees');
select ok((select count(*) from public.audit_logs) > 0, 'admin reads the audit log');
select tests.logout();

select * from finish();
rollback;
