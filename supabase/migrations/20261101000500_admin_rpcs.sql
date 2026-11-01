-- =============================================================================
-- Admin and employee RPCs. Every admin RPC starts with assert_admin(); errors use the codes of
-- the catalog (docs/phase-1-system-analysis/05-business-rules.md §15) as the exception message
-- so the web/mobile clients can translate them.
-- =============================================================================

-- Registration pre-check (anon) – lets /register show BHW_ID_TAKEN / EMAIL_TAKEN before signUp,
-- because GoTrue hides trigger errors behind a generic message.
create or replace function public.check_registration_available(p_bhw_id_number text, p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.profiles p
                 where upper(p.bhw_id_number) = upper(btrim(p_bhw_id_number))) then 'BHW_ID_TAKEN'
    when exists (select 1 from auth.users u where lower(u.email) = lower(btrim(p_email))) then 'EMAIL_TAKEN'
    else null
  end;
$$;
grant execute on function public.check_registration_available(text, text) to anon, authenticated;

-- Pending approvals: only e-mail-verified registrations (BR-11).
create or replace function public.list_pending_registrations()
returns table (
  id uuid, full_name text, bhw_id_number text, area text, email text, photo_url text,
  created_at timestamptz, email_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
    select p.id, p.full_name, p.bhw_id_number, p.area, p.email, p.photo_url, p.created_at,
           u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.status = 'pending' and p.role = 'employee' and u.email_confirmed_at is not null
    order by p.created_at;
end;
$$;

-- Approve with schedule (FR-22, BR-12).
create or replace function public.approve_employee(
  p_employee_id uuid, p_schedule_id uuid, p_effective_from date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform public.assert_admin();
  if p_schedule_id is null or not exists (select 1 from public.schedules s where s.id = p_schedule_id) then
    raise exception 'SCHEDULE_REQUIRED';
  end if;
  select * into v_profile from public.profiles where id = p_employee_id for update;
  if v_profile.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_profile.status <> 'pending' or v_profile.role <> 'employee' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  perform public.set_audit_context('approve_employee');
  update public.profiles
  set status = 'active', approved_by = auth.uid(), approved_at = now(), rejection_reason = null
  where id = p_employee_id;

  insert into public.employee_schedules (employee_id, schedule_id, effective_from)
  values (p_employee_id, p_schedule_id, coalesce(p_effective_from, public.manila_today()));

  perform public.notify_user(p_employee_id, 'registration_approved',
    'Registration approved',
    'Your BHW attendance account is now active. Install the mobile app and log in to register your phone.');
end;
$$;

-- Reject with reason (FR-23, BR-13).
create or replace function public.reject_employee(p_employee_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_profile from public.profiles where id = p_employee_id for update;
  if v_profile.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_profile.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;
  perform public.set_audit_context('reject_employee');
  update public.profiles
  set status = 'rejected', rejection_reason = btrim(p_reason), approved_by = auth.uid(),
      approved_at = now()
  where id = p_employee_id;
  perform public.notify_user(p_employee_id, 'registration_rejected', 'Registration not approved',
    'Reason: ' || btrim(p_reason));
end;
$$;

-- Deactivate / reactivate (state table §2.1).
create or replace function public.deactivate_employee(p_employee_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_employee_id = auth.uid() then
    raise exception 'FORBIDDEN' using detail = 'Admins cannot deactivate their own account';
  end if;
  perform public.set_audit_context('deactivate_employee: ' || btrim(p_reason));
  update public.profiles set status = 'inactive'
  where id = p_employee_id and status = 'active';
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.reactivate_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  perform public.set_audit_context('reactivate_employee');
  update public.profiles set status = 'active'
  where id = p_employee_id and status = 'inactive';
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

-- Device reset (FR-32, D-07).
create or replace function public.reset_device(p_employee_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;
  perform public.set_audit_context('reset_device: ' || btrim(p_reason));
  update public.devices set revoked_at = now()
  where employee_id = p_employee_id and revoked_at is null;
  if not found then
    raise exception 'NOT_FOUND' using detail = 'No active device to reset';
  end if;
  perform public.notify_user(p_employee_id, 'device_reset', 'Phone registration reset',
    'Your registered phone was reset by the administrator. Log in on your phone to register it again.');
end;
$$;

-- Schedule assignment with effective dating (D-19, BR-51). Closes the open assignment.
create or replace function public.assign_schedule(
  p_employee_id uuid, p_schedule_id uuid, p_effective_from date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  perform public.set_audit_context('assign_schedule');
  update public.employee_schedules
  set effective_to = p_effective_from - 1
  where employee_id = p_employee_id and effective_from < p_effective_from
    and (effective_to is null or effective_to >= p_effective_from);
  insert into public.employee_schedules (employee_id, schedule_id, effective_from)
  values (p_employee_id, p_schedule_id, p_effective_from);
exception
  when exclusion_violation or unique_violation then
    raise exception 'SCHEDULE_OVERLAP';
end;
$$;

-- Schedules that were ever assigned cannot be deleted (BR-52).
create or replace function public.guard_schedule_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.employee_schedules es where es.schedule_id = old.id) then
    raise exception 'SCHEDULE_IN_USE';
  end if;
  return old;
end;
$$;
create trigger schedules_delete_guard before delete on public.schedules
  for each row execute function public.guard_schedule_delete();

-- Manual attendance entry with required reason (FR-65, BR-60).
create or replace function public.manual_attendance_entry(
  p_employee_id uuid, p_work_date date, p_time_in time, p_time_out time, p_reason text,
  p_station_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.attendance_records;
  v_in timestamptz;
  v_out timestamptz;
  v_c record;
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_employee_id and p.role = 'employee') then
    raise exception 'NOT_FOUND';
  end if;
  if p_time_in is null and p_time_out is null then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select * into v_rec from public.attendance_records
  where employee_id = p_employee_id and work_date = p_work_date for update;

  v_in := coalesce(public.manila_ts(p_work_date, p_time_in), v_rec.time_in);
  v_out := coalesce(public.manila_ts(p_work_date, p_time_out), v_rec.time_out);
  if v_in is null then
    raise exception 'INVALID_TIME_RANGE' using detail = 'A time-in is required';
  end if;
  if v_in > now() or (v_out is not null and v_out > now()) then
    raise exception 'FUTURE_TIME_NOT_ALLOWED';
  end if;
  if v_out is not null and v_out <= v_in then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select * into v_c from public.compute_attendance_status(
    p_employee_id, p_work_date, v_in, v_out, p_work_date < public.manila_today());

  perform public.set_audit_context('manual_attendance_entry: ' || btrim(p_reason));
  insert into public.attendance_records as ar (
    employee_id, work_date, time_in, time_out, station_id, status, minutes_late,
    undertime_minutes, method, notes, created_by
  ) values (
    p_employee_id, p_work_date, v_in, v_out, coalesce(p_station_id, v_rec.station_id), v_c.status,
    v_c.minutes_late, v_c.undertime_minutes, 'manual', btrim(p_reason), auth.uid()
  )
  on conflict (employee_id, work_date) do update
    set time_in = excluded.time_in, time_out = excluded.time_out,
        station_id = excluded.station_id, status = excluded.status,
        minutes_late = excluded.minutes_late, undertime_minutes = excluded.undertime_minutes,
        method = 'manual', notes = excluded.notes, created_by = excluded.created_by
  returning * into v_rec;
  return v_rec.id;
end;
$$;

-- Correction requests (core flow 6, D-25..D-28) ------------------------------------------

-- Eligibility (D-26, BR-64): not in the future; current month, or previous month while
-- today <= correction_window_days.
create or replace function public.correction_date_eligible(p_work_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_work_date <= public.manila_today()
    and (
      date_trunc('month', p_work_date) = date_trunc('month', public.manila_today())
      or (
        date_trunc('month', p_work_date) = date_trunc('month', public.manila_today()) - interval '1 month'
        and extract(day from public.manila_today()) <= (select s.correction_window_days from public.app_settings s where s.id = 1)
      )
    );
$$;

-- Validates every new request (RLS insert path and RPC path alike).
create or replace function public.validate_correction_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.correction_date_eligible(new.work_date) then
    raise exception 'CORRECTION_NOT_ELIGIBLE';
  end if;
  if (new.requested_time_in is not null and new.requested_time_in > now())
     or (new.requested_time_out is not null and new.requested_time_out > now()) then
    raise exception 'FUTURE_TIME_NOT_ALLOWED';
  end if;
  select ar.id into new.attendance_record_id from public.attendance_records ar
  where ar.employee_id = new.employee_id and ar.work_date = new.work_date;
  return new;
end;
$$;
create trigger correction_validate_insert before insert on public.correction_requests
  for each row execute function public.validate_correction_insert();

-- Employee files a request with Manila wall-clock times (FR-68..FR-70).
create or replace function public.file_correction_request(
  p_work_date date, p_type public.correction_type, p_time_in time, p_time_out time,
  p_reason text, p_attachment_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_active_employee() then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_time_in is not null and p_time_out is not null and p_time_out <= p_time_in then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  if p_attachment_path is not null and split_part(p_attachment_path, '/', 1) <> auth.uid()::text then
    raise exception 'FORBIDDEN' using detail = 'Attachment must be in your own folder';
  end if;
  insert into public.correction_requests (
    employee_id, work_date, type, requested_time_in, requested_time_out, reason, attachment_url
  ) values (
    auth.uid(), p_work_date, p_type, public.manila_ts(p_work_date, p_time_in),
    public.manila_ts(p_work_date, p_time_out), btrim(p_reason), p_attachment_path
  )
  returning id into v_id;

  perform public.notify_admins('new_correction_request', 'New correction request',
    (select p.full_name from public.profiles p where p.id = auth.uid()) || ' filed a ' ||
    replace(p_type::text, '_', ' ') || ' request for ' || to_char(p_work_date, 'Mon DD, YYYY') || '.');
  return v_id;
exception when unique_violation then
  raise exception 'CORRECTION_DUPLICATE';
end;
$$;

create or replace function public.cancel_correction_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.correction_requests set status = 'cancelled'
  where id = p_request_id and employee_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'REQUEST_NOT_PENDING';
  end if;
end;
$$;

-- Admin approves or rejects (FR-74, BR-70..BR-72). Approval updates the record in the same
-- transaction, so the DTR (computed from records) changes automatically (AC-08).
create or replace function public.review_correction_request(
  p_request_id uuid, p_decision public.correction_status, p_remarks text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.correction_requests;
  v_rec public.attendance_records;
  v_sched public.schedules;
  v_in timestamptz;
  v_out timestamptz;
  v_c record;
  v_note text;
begin
  perform public.assert_admin();
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_REQUEST';
  end if;
  select * into v_req from public.correction_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  if p_decision = 'rejected' then
    if char_length(btrim(coalesce(p_remarks, ''))) < 10 then
      raise exception 'REASON_REQUIRED';
    end if;
    perform public.set_audit_context('reject_correction');
    update public.correction_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), remarks = btrim(p_remarks)
    where id = p_request_id;
    perform public.notify_user(v_req.employee_id, 'correction_rejected', 'Correction request not approved',
      to_char(v_req.work_date, 'Mon DD, YYYY') || ': ' || btrim(p_remarks));
    return;
  end if;

  select * into v_rec from public.attendance_records
  where employee_id = v_req.employee_id and work_date = v_req.work_date for update;

  v_in := v_rec.time_in;
  v_out := v_rec.time_out;
  case v_req.type
    when 'missing_time_in' then v_in := v_req.requested_time_in;
    when 'missing_time_out' then v_out := v_req.requested_time_out;
    when 'wrong_time' then
      v_in := coalesce(v_req.requested_time_in, v_in);
      v_out := coalesce(v_req.requested_time_out, v_out);
    when 'official_business' then
      select * into v_sched from public.schedule_for(v_req.employee_id, v_req.work_date);
      if v_req.requested_time_in is null and v_req.requested_time_out is null and v_sched.id is null then
        raise exception 'SCHEDULE_REQUIRED';
      end if;
      v_in := coalesce(v_req.requested_time_in, public.manila_ts(v_req.work_date, v_sched.start_time));
      v_out := coalesce(v_req.requested_time_out, public.manila_ts(v_req.work_date, v_sched.end_time));
      v_note := 'Official business';
  end case;

  if v_in is null then
    raise exception 'INVALID_TIME_RANGE' using detail = 'The record still has no time-in';
  end if;
  if v_out is not null and v_out <= v_in then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select * into v_c from public.compute_attendance_status(
    v_req.employee_id, v_req.work_date, v_in, v_out, v_req.work_date < public.manila_today());

  perform public.set_audit_context('approve_correction');
  insert into public.attendance_records as ar (
    employee_id, work_date, time_in, time_out, status, minutes_late, undertime_minutes, method,
    notes, created_by
  ) values (
    v_req.employee_id, v_req.work_date, v_in, v_out, v_c.status, v_c.minutes_late,
    v_c.undertime_minutes, 'correction',
    coalesce(v_note, 'Correction: ' || left(v_req.reason, 200)), auth.uid()
  )
  on conflict (employee_id, work_date) do update
    set time_in = excluded.time_in, time_out = excluded.time_out, status = excluded.status,
        minutes_late = excluded.minutes_late, undertime_minutes = excluded.undertime_minutes,
        method = 'correction', notes = excluded.notes, created_by = excluded.created_by
  returning * into v_rec;

  update public.correction_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      remarks = nullif(btrim(coalesce(p_remarks, '')), ''), attendance_record_id = v_rec.id
  where id = p_request_id;

  perform public.notify_user(v_req.employee_id, 'correction_approved', 'Correction request approved',
    to_char(v_req.work_date, 'Mon DD, YYYY') || ' was updated. Your DTR now shows the corrected time.');
end;
$$;

-- Recompute statuses after schedule or holiday changes (FR-106). Absent rows on dates that are
-- no longer work days are removed.
create or replace function public.recompute_attendance(
  p_from date, p_to date, p_employee_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.attendance_records;
  v_c record;
  v_count int := 0;
begin
  perform public.assert_admin();
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  perform public.set_audit_context('recompute_attendance');

  delete from public.attendance_records ar
  where ar.work_date between p_from and p_to
    and (p_employee_id is null or ar.employee_id = p_employee_id)
    and ar.status = 'absent' and ar.created_by is null
    and not public.is_work_day(ar.employee_id, ar.work_date);

  for v_rec in
    select * from public.attendance_records ar
    where ar.work_date between p_from and p_to
      and (p_employee_id is null or ar.employee_id = p_employee_id)
      and ar.status <> 'absent'
    for update
  loop
    select * into v_c from public.compute_attendance_status(
      v_rec.employee_id, v_rec.work_date, v_rec.time_in, v_rec.time_out,
      v_rec.work_date < public.manila_today() or v_rec.status = 'incomplete');
    if (v_c.status, v_c.minutes_late, v_c.undertime_minutes)
       is distinct from (v_rec.status, v_rec.minutes_late, v_rec.undertime_minutes) then
      update public.attendance_records
      set status = v_c.status, minutes_late = v_c.minutes_late, undertime_minutes = v_c.undertime_minutes
      where id = v_rec.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Active stations for the mobile health check and admin pages.
create or replace function public.get_active_stations()
returns table (id uuid, name text, latitude numeric, longitude numeric, radius_m int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.latitude, s.longitude,
         coalesce(s.radius_m, (select a.geofence_radius_m from public.app_settings a where a.id = 1))
  from public.stations s
  where s.is_active and (public.is_admin() or public.is_active_employee())
  order by s.name;
$$;

-- Kiosk live feed: first name + action + Manila time for the kiosk's own station (or admin).
create or replace function public.get_kiosk_feed(p_station_id uuid, p_limit int default 10)
returns table (first_name text, action text, at_time text, status public.attendance_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.stations s where s.id = p_station_id and s.kiosk_user_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select split_part(p.full_name, ' ', 1),
           case when ar.time_out_scan_id = sa.id then 'time_out' else 'time_in' end,
           to_char(sa.created_at at time zone 'Asia/Manila', 'HH24:MI'),
           ar.status
    from public.scan_attempts sa
    join public.profiles p on p.id = sa.employee_id
    left join public.attendance_records ar
      on ar.time_in_scan_id = sa.id or ar.time_out_scan_id = sa.id
    where sa.station_id = p_station_id and sa.success
      and sa.created_at > now() - interval '12 hours'
    order by sa.created_at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

-- Kiosk / viewer / admin account creation is done server-side with the Supabase Admin API
-- (apps/web Server Action) which sets raw_app_meta_data.role; see handle_new_user().

grant execute on all functions in schema public to authenticated;
-- Service-only functions must stay closed even after the blanket grant above.
revoke execute on function public.apply_punch(uuid, timestamptz, uuid, public.attendance_method, uuid, uuid, text),
  public.log_scan_attempt(uuid, uuid, text, text, double precision, double precision, double precision, text, uuid, text),
  public.record_scan(uuid, text, uuid, uuid, boolean, boolean, double precision, double precision, double precision, text),
  public.record_fallback_scan(uuid, uuid, uuid, uuid, boolean, boolean),
  public.record_device_sync_event(uuid, text, uuid, timestamptz),
  public.register_qr_nonce(uuid, uuid, uuid, int),
  public.record_heartbeat(uuid, uuid, text, bigint, bigint),
  public.bind_device(uuid, text, public.device_platform, text),
  public.check_device(uuid, text),
  public.pii_key(), public.encrypt_pii(text), public.decrypt_pii(bytea),
  public.notify_user(uuid, public.notification_kind, text, text),
  public.notify_admins(public.notification_kind, text, text),
  public.log_error_internal(public.error_source, public.error_severity, text, jsonb, uuid),
  public.set_audit_context(text, uuid)
  from authenticated;
