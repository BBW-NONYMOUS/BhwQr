-- Status computation (D-15..D-18, BR-03) and schema-level rules.
begin;
select plan(16);

-- Maria (seeded): Mon–Fri 08:00–17:00, grace 15. Use a Monday 3 weeks from today, which is
-- inside her schedule and not a holiday (unless it collides – then skip by picking Tuesday).
create temp table d as
select (public.manila_today() + 21 - (extract(isodow from public.manila_today())::int - 1))::date as mon;
insert into public.holidays (date, name) values ((select mon from d) + 2, 'Test Holiday');

-- 08:10 with 15 grace -> on time
select is((select status::text from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d), public.manila_ts((select mon from d), '08:10'), null)),
  'on_time', '08:10 is on time within the 15-minute grace');
-- 08:15:59 -> truncated to 08:15 -> on time (BR-03)
select is((select minutes_late from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d),
  public.manila_ts((select mon from d), '08:15') + interval '59 seconds', null)),
  0, '08:15:59 is on time (seconds truncated)');
-- 08:16 -> late 16 minutes (counted from start, not from end of grace)
select results_eq($$select status::text, minutes_late from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d), public.manila_ts((select mon from d), '08:16'), null)$$,
  $$values ('late', 16)$$, '08:16 is late by 16 minutes');
-- Undertime: out 16:30 -> 30 minutes
select results_eq($$select status::text, undertime_minutes from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d),
  public.manila_ts((select mon from d), '07:55'), public.manila_ts((select mon from d), '16:30'))$$,
  $$values ('undertime', 30)$$, 'leaving 16:30 gives 30 minutes undertime');
-- Late + undertime -> late, both numbers kept (D-17)
select results_eq($$select status::text, minutes_late, undertime_minutes from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d),
  public.manila_ts((select mon from d), '08:30'), public.manila_ts((select mon from d), '16:45'))$$,
  $$values ('late', 30, 15)$$, 'late and undertime: status late, both minutes stored');
-- Overtime is not negative undertime
select is((select undertime_minutes from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d),
  public.manila_ts((select mon from d), '07:55'), public.manila_ts((select mon from d), '18:30'))),
  0, 'leaving after 17:00 gives 0 undertime');
-- Incomplete once the day is closed
select is((select status::text from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d), public.manila_ts((select mon from d), '07:55'), null, true)),
  'incomplete', 'no time-out after day close is incomplete');
-- Absent when no time-in
select is((select status::text from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d), null, null, true)),
  'absent', 'no time-in is absent');
-- Holiday -> on time with holiday name (D-18)
select results_eq($$select status::text, minutes_late, note from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d) + 2,
  public.manila_ts((select mon from d) + 2, '10:00'), null)$$,
  $$values ('on_time', 0, 'Test Holiday')$$, 'holiday scans are on time with the holiday name');
-- Saturday -> non-working day
select results_eq($$select status::text, note from public.compute_attendance_status(
  '30000000-0000-4000-a000-000000000001', (select mon from d) + 5,
  public.manila_ts((select mon from d) + 5, '09:30'), null)$$,
  $$values ('on_time', 'Non-working day')$$, 'Saturday scans are non-working day');
-- No schedule (admin has none)
select is((select note from public.compute_attendance_status(
  '00000000-0000-4000-a000-000000000001', (select mon from d), public.manila_ts((select mon from d), '10:00'), null)),
  'No schedule assigned', 'employee without schedule gets the note');

-- Manila date math (BR-01)
select is(public.manila_minute('2026-11-09 23:55:30+00'), '2026-11-10 07:55:00'::timestamp,
  '23:55 UTC is 07:55 next day in Manila');
-- Haversine: ~111.2 km per degree of latitude
select ok(abs(public.haversine_distance_m(6.0, 124.0, 7.0, 124.0) - 111195) < 100, 'haversine distance');

-- Constraints
select throws_ok($$insert into public.attendance_records (employee_id, work_date, status, method, notes, created_by)
  values ('30000000-0000-4000-a000-000000000001', '2020-01-06', 'on_time', 'manual', 'short', '00000000-0000-4000-a000-000000000001')$$,
  '23514', null, 'manual entries need a reason of 10+ characters and a time-in');
select throws_ok($$insert into public.schedules (name, work_days, start_time, end_time) values ('Bad', '{8}', '08:00', '17:00')$$,
  '23514', null, 'work_days must be ISO 1..7');
select throws_ok($$insert into public.app_settings (id) values (2)$$, '23514', null, 'app_settings is single-row');

select * from finish();
rollback;
