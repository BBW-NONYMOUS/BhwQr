-- =============================================================================
-- Follow-ups found while building the Phase 4 admin screens.
-- 1. Changing app_settings.overnight_cutoff_hour reschedules the end-of-day job (D-21: it runs
--    5 minutes after the cutoff, Manila time = UTC+8).
-- 2. Length checks aligned with the data dictionary (holiday name 2–120, office name 2–150,
--    office address 2–200).
-- 3. get_report_areas(): purok list for report filters (viewers cannot read profiles).
-- =============================================================================

-- 1. End-of-day job follows the cutoff --------------------------------------------------------
create or replace function public.end_of_day_cron(p_cutoff_hour int)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Manila hour h is UTC hour (h - 8) mod 24; the job runs at hh:05.
  select format('5 %s * * *', ((p_cutoff_hour - 8) % 24 + 24) % 24);
$$;

create or replace function public.reschedule_end_of_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.overnight_cutoff_hour is distinct from old.overnight_cutoff_hour then
    -- cron.schedule with an existing job name updates that job in place.
    perform cron.schedule('bhw-end-of-day', public.end_of_day_cron(new.overnight_cutoff_hour),
      'select public.run_end_of_day()');
  end if;
  return new;
end;
$$;

create trigger app_settings_reschedule_end_of_day
  after update of overnight_cutoff_hour on public.app_settings
  for each row execute function public.reschedule_end_of_day();

-- Keep the existing job consistent with the current setting.
select cron.schedule('bhw-end-of-day',
  public.end_of_day_cron((select s.overnight_cutoff_hour from public.app_settings s where s.id = 1)),
  'select public.run_end_of_day()');

-- 2. Length checks ---------------------------------------------------------------------------
alter table public.holidays drop constraint if exists holidays_name_check;
alter table public.holidays
  add constraint holidays_name_check check (char_length(btrim(name)) between 2 and 120);

alter table public.app_settings
  add constraint app_settings_office_name_length check (char_length(btrim(office_name)) between 2 and 150),
  add constraint app_settings_office_address_length check (char_length(btrim(office_address)) between 2 and 200);

-- 3. Report areas ------------------------------------------------------------------------------
create or replace function public.get_report_areas()
returns table (area text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_reader();
  return query
    select distinct p.area from public.profiles p
    where p.role = 'employee' and p.status in ('active', 'inactive') and p.area is not null
    order by p.area;
end;
$$;
grant execute on function public.get_report_areas() to authenticated;
