-- =============================================================================
-- Row Level Security policies (FR-137..FR-141, BR-17..BR-19, access matrix in
-- docs/phase-2-architecture/04-operations-and-security.md §1).
-- Each policy has a one-line comment. Writes to attendance_records, scan_attempts, qr_nonces,
-- qr_nonce_uses, devices, kiosk_heartbeats and audit_logs have NO client policy: they happen only
-- through Edge Functions (service role bypasses RLS) and SECURITY DEFINER RPCs.
-- =============================================================================

-- Table privileges: clients reach tables only through RLS-filtered grants.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public
  from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.schedules, public.employee_schedules, public.stations,
  public.holidays to authenticated;
grant update on public.app_settings to authenticated;
grant insert (employee_id, attendance_record_id, work_date, type, requested_time_in,
  requested_time_out, reason, attachment_url) on public.correction_requests to authenticated;
grant update (status) on public.correction_requests to authenticated;
grant update (read_at) on public.notifications to authenticated;
-- Admin edits identity fields only; role/status/review columns change through RPCs.
grant update (full_name, area, bhw_id_number, photo_url) on public.profiles to authenticated;

-- profiles --------------------------------------------------------------------------
-- Everyone reads their own profile (status screens, /me, mobile auth guard).
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
-- Admin reads every profile (Employees, Pending Approvals).
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());
-- Admin edits identity fields (status/role change only through RPCs, which bypass column grants).
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- schedules / employee_schedules -----------------------------------------------------
-- Admin manages schedules.
create policy schedules_admin_all on public.schedules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Employees read schedules assigned to them (Home "Today" card, DTR header).
create policy schedules_select_assigned on public.schedules
  for select to authenticated using (
    exists (select 1 from public.employee_schedules es
            where es.schedule_id = schedules.id and es.employee_id = auth.uid())
  );
-- Viewers read schedule names for reports.
create policy schedules_select_viewer on public.schedules
  for select to authenticated using (public.is_viewer_or_admin());
-- Admin manages schedule assignments.
create policy employee_schedules_admin_all on public.employee_schedules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Employees read their own assignments.
create policy employee_schedules_select_own on public.employee_schedules
  for select to authenticated using (employee_id = auth.uid());

-- stations ------------------------------------------------------------------------------
-- Admin manages stations and kiosks.
create policy stations_admin_all on public.stations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- A kiosk account reads its own station (name, coordinates, online flag).
create policy stations_select_kiosk on public.stations
  for select to authenticated using (kiosk_user_id = auth.uid());
-- Viewers see station status on the read-only dashboard; employees see station names in history.
create policy stations_select_viewer_employee on public.stations
  for select to authenticated using (
    public.is_viewer_or_admin() or public.app_role() = 'employee'
  );

-- devices ------------------------------------------------------------------------------
-- Admin reads device bindings and history (reset happens through reset_device RPC).
create policy devices_select_admin on public.devices
  for select to authenticated using (public.is_admin());
-- Employees read their own device rows (Profile shows the bound phone).
create policy devices_select_own on public.devices
  for select to authenticated using (employee_id = auth.uid());

-- qr_nonces / qr_nonce_uses: service role only (no client policy). -----------------------

-- attendance_records ------------------------------------------------------------------
-- Admin reads all records (dashboard, Attendance Records, reports).
create policy attendance_select_admin on public.attendance_records
  for select to authenticated using (public.is_admin());
-- Employees read only their own records (History, DTR, Today card).
create policy attendance_select_own on public.attendance_records
  for select to authenticated using (employee_id = auth.uid());
-- Viewers and kiosks have no direct access; they use report RPCs / the kiosk feed RPC.

-- scan_attempts ----------------------------------------------------------------------
-- Admin reads scan attempts (Device Health, anomaly review, live scans).
create policy scan_attempts_select_admin on public.scan_attempts
  for select to authenticated using (public.is_admin());
-- Employees read their own attempts (to see why a scan failed).
create policy scan_attempts_select_own on public.scan_attempts
  for select to authenticated using (employee_id = auth.uid());

-- audit_logs ------------------------------------------------------------------------------
-- Admin only reads the audit log; nobody updates or deletes (append-only trigger as well).
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using (public.is_admin());

-- holidays ----------------------------------------------------------------------------
-- Every signed-in user reads holidays (DTR labels, mobile calendar).
create policy holidays_select_all on public.holidays
  for select to authenticated using (true);
-- Admin manages holidays.
create policy holidays_admin_write on public.holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- app_settings -------------------------------------------------------------------------
-- Every signed-in user reads settings (cooldown, token refresh, selfie flag shown in apps).
create policy app_settings_select_all on public.app_settings
  for select to authenticated using (true);
-- Admin updates settings.
create policy app_settings_admin_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- correction_requests ----------------------------------------------------------------
-- Admin reads all requests (review queue). Review happens through review_correction_request.
create policy corrections_select_admin on public.correction_requests
  for select to authenticated using (public.is_admin());
-- Employees read their own requests (My Requests).
create policy corrections_select_own on public.correction_requests
  for select to authenticated using (employee_id = auth.uid());
-- Active employees file requests for themselves only, as pending, unreviewed (eligibility window
-- D-26 is enforced again in file_correction_request).
create policy corrections_insert_own on public.correction_requests
  for insert to authenticated with check (
    employee_id = auth.uid() and status = 'pending' and reviewed_by is null
    and public.is_active_employee()
  );
-- Employees may only cancel their own pending request (pending -> cancelled).
create policy corrections_cancel_own on public.correction_requests
  for update to authenticated
  using (employee_id = auth.uid() and status = 'pending')
  with check (employee_id = auth.uid() and status = 'cancelled' and reviewed_by is null);

-- Column guard: an employee's cancel may change only status (trigger, because RLS cannot compare
-- old and new column values).
create or replace function public.guard_correction_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if (new.work_date, new.type, new.requested_time_in, new.requested_time_out, new.reason,
      new.attachment_url, new.employee_id, new.attendance_record_id, new.remarks)
     is distinct from
     (old.work_date, old.type, old.requested_time_in, old.requested_time_out, old.reason,
      old.attachment_url, old.employee_id, old.attendance_record_id, old.remarks) then
    raise exception 'REQUEST_NOT_PENDING' using errcode = '42501',
      detail = 'Only the status of a pending request can be changed by its owner';
  end if;
  return new;
end;
$$;
create trigger correction_cancel_guard before update on public.correction_requests
  for each row execute function public.guard_correction_cancel();

-- kiosk_heartbeats ------------------------------------------------------------------
-- Admin reads heartbeat history (Device Health). Inserts only via kiosk-heartbeat function.
create policy kiosk_heartbeats_select_admin on public.kiosk_heartbeats
  for select to authenticated using (public.is_admin());

-- error_logs ------------------------------------------------------------------------
-- Admin reads error logs. Inserts only via log-error function / SQL helpers.
create policy error_logs_select_admin on public.error_logs
  for select to authenticated using (public.is_admin());

-- notifications ------------------------------------------------------------------
-- Users read their own notifications.
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
-- Users mark their own notifications as read.
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Function execute privileges: anon may call nothing except the registration check (granted
-- in the RPC migration); helper functions used inside policies stay callable by authenticated.
revoke execute on all functions in schema public from anon;
