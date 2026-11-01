-- =============================================================================
-- Reports (FR-86..FR-94) and DTR (CSC Form No. 48, FR-78..FR-85, D-22..D-24).
-- Every number is derived from attendance_records only, so reports match raw records (AC-06).
-- =============================================================================

create or replace function public.assert_report_reader()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_viewer_or_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

-- Employees considered for a period: active employees, plus inactive ones who have records in it.
create or replace function public.report_employees(p_from date, p_to date, p_area text)
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.profiles p
  where p.role = 'employee'
    and (p.status = 'active' or (p.status = 'inactive' and exists (
      select 1 from public.attendance_records ar
      where ar.employee_id = p.id and ar.work_date between p_from and p_to)))
    and (p_area is null or p.area = p_area);
$$;
revoke all on function public.report_employees(date, date, text) from public, anon, authenticated;

create or replace function public.get_daily_summary(
  p_date date, p_area text default null, p_status public.attendance_status default null
)
returns table (
  employee_id uuid, full_name text, bhw_id_number text, area text, work_date date,
  time_in timestamptz, time_out timestamptz, status public.attendance_status, minutes_late int,
  undertime_minutes int, method public.attendance_method, station_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_reader();
  return query
    select p.id, p.full_name, p.bhw_id_number, p.area, p_date, ar.time_in, ar.time_out, ar.status,
           coalesce(ar.minutes_late, 0), coalesce(ar.undertime_minutes, 0), ar.method, s.name
    from public.report_employees(p_date, p_date, p_area) p
    left join public.attendance_records ar on ar.employee_id = p.id and ar.work_date = p_date
    left join public.stations s on s.id = ar.station_id
    where p_status is null or ar.status = p_status
    order by p.full_name;
end;
$$;

create or replace function public.get_weekly_summary(p_week_start date, p_area text default null)
returns table (
  employee_id uuid, full_name text, area text, week_start date, week_end date,
  on_time_days int, late_days int, undertime_days int, absent_days int, incomplete_days int,
  total_minutes_late int, total_undertime_minutes int, daily_status public.attendance_status[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_reader();
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'INVALID_REQUEST' using detail = 'p_week_start must be a Monday';
  end if;
  return query
    select p.id, p.full_name, p.area, p_week_start, p_week_start + 6,
      count(*) filter (where ar.status = 'on_time')::int,
      count(*) filter (where ar.status = 'late')::int,
      count(*) filter (where ar.status = 'undertime')::int,
      count(*) filter (where ar.status = 'absent')::int,
      count(*) filter (where ar.status = 'incomplete')::int,
      coalesce(sum(ar.minutes_late), 0)::int,
      coalesce(sum(ar.undertime_minutes), 0)::int,
      array(
        select ar2.status from generate_series(p_week_start, p_week_start + 6, interval '1 day') d
        left join public.attendance_records ar2 on ar2.employee_id = p.id and ar2.work_date = d::date
        order by d
      )
    from public.report_employees(p_week_start, p_week_start + 6, p_area) p
    left join public.attendance_records ar
      on ar.employee_id = p.id and ar.work_date between p_week_start and p_week_start + 6
    group by p.id, p.full_name, p.area
    order by p.full_name;
end;
$$;

-- Scheduled work days of an employee in a range, minus holidays.
create or replace function public.scheduled_work_days(p_employee_id uuid, p_from date, p_to date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from generate_series(p_from, p_to, interval '1 day') d
  where public.is_work_day(p_employee_id, d::date);
$$;

create or replace function public.get_monthly_summary(p_year int, p_month int, p_area text default null)
returns table (
  employee_id uuid, full_name text, bhw_id_number text, area text, scheduled_work_days int,
  days_present int, on_time_days int, late_days int, undertime_days int, absent_days int,
  incomplete_days int, total_minutes_late int, total_undertime_minutes int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
begin
  perform public.assert_report_reader();
  return query
    select p.id, p.full_name, p.bhw_id_number, p.area,
      public.scheduled_work_days(p.id, v_from, v_to),
      count(*) filter (where ar.time_in is not null)::int,
      count(*) filter (where ar.status = 'on_time')::int,
      count(*) filter (where ar.status = 'late')::int,
      count(*) filter (where ar.status = 'undertime')::int,
      count(*) filter (where ar.status = 'absent')::int,
      count(*) filter (where ar.status = 'incomplete')::int,
      coalesce(sum(ar.minutes_late), 0)::int,
      coalesce(sum(ar.undertime_minutes), 0)::int
    from public.report_employees(v_from, v_to, p_area) p
    left join public.attendance_records ar
      on ar.employee_id = p.id and ar.work_date between v_from and v_to
    group by p.id, p.full_name, p.bhw_id_number, p.area
    order by p.full_name;
end;
$$;

create or replace function public.get_employee_history(p_employee_id uuid, p_from date, p_to date)
returns table (
  id uuid, work_date date, time_in timestamptz, time_out timestamptz,
  status public.attendance_status, minutes_late int, undertime_minutes int,
  method public.attendance_method, notes text, station_name text, pending_correction boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from p_employee_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select ar.id, ar.work_date, ar.time_in, ar.time_out, ar.status, ar.minutes_late,
           ar.undertime_minutes, ar.method, ar.notes, s.name,
           exists (select 1 from public.correction_requests cr
                   where cr.employee_id = ar.employee_id and cr.work_date = ar.work_date
                     and cr.status = 'pending')
    from public.attendance_records ar
    left join public.stations s on s.id = ar.station_id
    where ar.employee_id = p_employee_id and ar.work_date between p_from and p_to
    order by ar.work_date desc;
end;
$$;

create or replace function public.get_dashboard_today()
returns table (
  work_date date, total_employees int, present_count int, on_time_count int, late_count int,
  undertime_count int, incomplete_count int, absent_count int, no_record_yet_count int,
  pending_registrations int, pending_corrections int, offline_stations int, critical_errors_24h int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.manila_today();
  v_admin boolean := public.is_admin();
begin
  perform public.assert_report_reader();
  return query
    with emp as (
      select p.id from public.profiles p where p.role = 'employee' and p.status = 'active'
    ), rec as (
      select ar.* from public.attendance_records ar join emp on emp.id = ar.employee_id
      where ar.work_date = v_today
    )
    select v_today,
      (select count(*) from emp)::int,
      (select count(*) from rec where rec.time_in is not null)::int,
      (select count(*) from rec where rec.status = 'on_time')::int,
      (select count(*) from rec where rec.status = 'late')::int,
      (select count(*) from rec where rec.status = 'undertime')::int,
      (select count(*) from rec where rec.status = 'incomplete')::int,
      (select count(*) from rec where rec.status = 'absent')::int,
      (select count(*) from emp
        where public.is_work_day(emp.id, v_today)
          and not exists (select 1 from rec where rec.employee_id = emp.id))::int,
      case when v_admin then (select count(*) from public.profiles p
        join auth.users u on u.id = p.id
        where p.status = 'pending' and u.email_confirmed_at is not null)::int else 0 end,
      case when v_admin then (select count(*) from public.correction_requests cr
        where cr.status = 'pending')::int else 0 end,
      case when v_admin then (select count(*) from public.stations s
        where s.is_active and not s.is_online)::int else 0 end,
      case when v_admin then (select count(*) from public.error_logs e
        where e.severity = 'critical' and e.created_at > now() - interval '24 hours')::int else 0 end;
end;
$$;

-- Weekly trend for the dashboard stacked bar chart (last 7 Manila days).
create or replace function public.get_attendance_trend(p_days int default 7)
returns table (
  work_date date, on_time int, late int, undertime int, incomplete int, absent int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_reader();
  return query
    select d::date,
      count(ar.*) filter (where ar.status = 'on_time')::int,
      count(ar.*) filter (where ar.status = 'late')::int,
      count(ar.*) filter (where ar.status = 'undertime')::int,
      count(ar.*) filter (where ar.status = 'incomplete')::int,
      count(ar.*) filter (where ar.status = 'absent')::int
    from generate_series(public.manila_today() - (least(greatest(p_days, 1), 31) - 1),
                         public.manila_today(), interval '1 day') d
    left join public.attendance_records ar on ar.work_date = d::date
    group by d
    order by d;
end;
$$;

-- -----------------------------------------------------------------------------
-- DTR – CSC Form No. 48
-- -----------------------------------------------------------------------------
create type public.dtr_row as (
  day smallint,
  work_date date,
  am_arrival time,
  am_departure time,
  pm_arrival time,
  pm_departure time,
  undertime_hours smallint,
  undertime_minutes smallint,
  remark text,
  status public.attendance_status,
  method public.attendance_method
);

-- Always 31 rows (one per printed line). D-22: AM/PM split by the schedule break;
-- D-23: daily undertime = minutes_late + undertime_minutes, full scheduled minutes when absent.
create or replace function public.dtr_month(p_employee_id uuid, p_year int, p_month int)
returns setof public.dtr_row
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select n::smallint as day,
           case when n <= extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))
                then make_date(p_year, p_month, n) end as work_date
    from generate_series(1, 31) n
  ), cfg as (
    select a.dtr_fill_break_times as fill from public.app_settings a where a.id = 1
  ), base as (
    select d.day, d.work_date, ar.time_in, ar.time_out, ar.status, ar.method, ar.minutes_late,
           ar.undertime_minutes, ar.notes, h.name as holiday, s.id as sched_id,
           coalesce(s.break_start, '12:00'::time) as break_start,
           coalesce(s.break_end, '13:00'::time) as break_end,
           s.start_time, s.end_time, s.work_days,
           (ar.time_in at time zone 'Asia/Manila') as tin,
           (ar.time_out at time zone 'Asia/Manila') as tout
    from days d
    left join public.attendance_records ar
      on ar.employee_id = p_employee_id and ar.work_date = d.work_date
    left join public.holidays h on h.date = d.work_date
    left join lateral public.schedule_for(p_employee_id, d.work_date) s on d.work_date is not null
  ), calc as (
    select b.*,
      case
        when b.status = 'absent' and b.sched_id is not null then
          (extract(epoch from (b.end_time - b.start_time) - (b.break_end - b.break_start)) / 60)::int
        when b.status is null or b.status = 'absent' then 0
        else b.minutes_late + b.undertime_minutes
      end as ut_total,
      b.tin is not null and b.tin < b.work_date + b.break_start
        and b.tout is not null and b.tout > b.work_date + b.break_end as spans_break
    from base b
  )
  select
    c.day,
    c.work_date,
    case when c.tin < c.work_date + c.break_start then date_trunc('minute', c.tin)::time end,
    case
      when c.tout is not null and c.tout <= c.work_date + c.break_end then date_trunc('minute', c.tout)::time
      when c.spans_break and (select fill from cfg) then c.break_start
    end,
    case
      when c.tin >= c.work_date + c.break_start then date_trunc('minute', c.tin)::time
      when c.spans_break and (select fill from cfg) then c.break_end
    end,
    case when c.tout > c.work_date + c.break_end then date_trunc('minute', c.tout)::time end,
    (c.ut_total / 60)::smallint,
    (c.ut_total % 60)::smallint,
    case
      when c.work_date is null then null
      when c.status = 'absent' then 'Absent'
      when c.status = 'incomplete' then 'No time-out'
      when c.status is not null and c.notes = 'Official business' then 'Official business'
      when c.status is not null and c.holiday is not null then c.holiday
      when c.status is not null and c.notes in ('Non-working day', 'No schedule assigned') then c.notes
      when c.status is not null then null
      when c.holiday is not null then c.holiday
      when extract(isodow from c.work_date) = 6 then 'Saturday'
      when extract(isodow from c.work_date) = 7 then 'Sunday'
      else null
    end,
    c.status,
    c.method
  from calc c
  order by c.day;
$$;
revoke all on function public.dtr_month(uuid, int, int) from public, anon, authenticated;

create or replace function public.dtr_document(p_employee_id uuid, p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_set public.app_settings := public.settings();
  v_sched public.schedules;
  v_rows jsonb;
  v_total int;
  v_days text;
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
begin
  select * into v_profile from public.profiles where id = p_employee_id;
  if v_profile.id is null then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_sched from public.schedule_for(p_employee_id, least(v_to, public.manila_today()));
  if v_sched.id is null then
    select * into v_sched from public.schedule_for(p_employee_id, v_from);
  end if;

  select jsonb_agg(to_jsonb(r) order by r.day),
         sum(r.undertime_hours * 60 + r.undertime_minutes)
  into v_rows, v_total
  from public.dtr_month(p_employee_id, p_year, p_month) r;

  if v_sched.id is not null then
    select string_agg(to_char(make_date(2024, 1, d), 'Dy'), ', ' order by d) into v_days
    from unnest(v_sched.work_days) d where d between 1 and 5;
  end if;

  return jsonb_build_object(
    'employee', jsonb_build_object('id', v_profile.id, 'full_name', v_profile.full_name,
      'bhw_id_number', v_profile.bhw_id_number),
    'period', jsonb_build_object('year', p_year, 'month', p_month,
      'label', trim(to_char(v_from, 'FMMonth YYYY'))),
    'office', jsonb_build_object('name', v_set.office_name, 'address', v_set.office_address),
    'office_hours', jsonb_build_object(
      'regular_days', case when v_sched.id is null then '' else
        coalesce(v_days, '') || ', ' || to_char(v_sched.start_time, 'HH24:MI') || '–' ||
        to_char(v_sched.break_start, 'HH24:MI') || ' / ' || to_char(v_sched.break_end, 'HH24:MI') ||
        '–' || to_char(v_sched.end_time, 'HH24:MI') end,
      'saturdays', case when v_sched.id is not null and 6 = any (v_sched.work_days) then
        to_char(v_sched.start_time, 'HH24:MI') || '–' || to_char(v_sched.end_time, 'HH24:MI')
        else '' end),
    'rows', v_rows,
    'totals', (
      select jsonb_build_object(
        'undertime_total_minutes', coalesce(v_total, 0),
        'undertime_hours', coalesce(v_total, 0) / 60,
        'undertime_minutes', coalesce(v_total, 0) % 60,
        'days_present', count(*) filter (where ar.time_in is not null),
        'days_absent', count(*) filter (where ar.status = 'absent'),
        'days_late', count(*) filter (where ar.status = 'late'),
        'days_undertime', count(*) filter (where ar.status = 'undertime'),
        'days_incomplete', count(*) filter (where ar.status = 'incomplete'))
      from public.attendance_records ar
      where ar.employee_id = p_employee_id and ar.work_date between v_from and v_to),
    'certification', 'I certify on my honor that the above is a true and correct report of the '
      || 'hours of work performed, record of which was made daily at the time of arrival and '
      || 'departure from office.',
    'verified_label', 'Verified as to the prescribed office hours:',
    'generated_at', now()
  );
end;
$$;
revoke all on function public.dtr_document(uuid, int, int) from public, anon, authenticated;

create or replace function public.get_dtr(p_employee_id uuid, p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from p_employee_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_month not between 1 and 12 or p_year not between 2024 and 2100 then
    raise exception 'INVALID_REQUEST';
  end if;
  return public.dtr_document(p_employee_id, p_year, p_month);
end;
$$;

create or replace function public.get_dtr_batch(p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
begin
  perform public.assert_admin();
  return coalesce((
    select jsonb_agg(public.dtr_document(p.id, p_year, p_month) order by p.full_name)
    from public.report_employees(v_from, v_to, null) p
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_daily_summary(date, text, public.attendance_status),
  public.get_weekly_summary(date, text), public.get_monthly_summary(int, int, text),
  public.get_employee_history(uuid, date, date), public.get_dashboard_today(),
  public.get_attendance_trend(int), public.get_dtr(uuid, int, int), public.get_dtr_batch(int, int),
  public.scheduled_work_days(uuid, date, date)
  to authenticated;
