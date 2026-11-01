-- =============================================================================
-- Fixes found while building the Phase 4 screens.
-- 1. review_correction_request: a 'missing_time_in' request may also carry the time-out, so an
--    absent day can be fixed in one request (BR-63). The time-out was ignored before.
-- 2. list_pending_registrations returns consent_at (FR-21 shows the consent date).
-- =============================================================================

drop function if exists public.list_pending_registrations();
create function public.list_pending_registrations()
returns table (
  id uuid, full_name text, bhw_id_number text, area text, email text, photo_url text,
  consent_at timestamptz, created_at timestamptz, email_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
    select p.id, p.full_name, p.bhw_id_number, p.area, p.email, p.photo_url, p.consent_at,
           p.created_at, u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.status = 'pending' and p.role = 'employee' and u.email_confirmed_at is not null
    order by p.created_at;
end;
$$;
grant execute on function public.list_pending_registrations() to authenticated;

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
    when 'missing_time_in' then
      v_in := v_req.requested_time_in;
      v_out := coalesce(v_req.requested_time_out, v_out);
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
