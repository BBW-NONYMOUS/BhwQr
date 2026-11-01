-- =============================================================================
-- Scheduled jobs (pg_cron, core flow 10), storage buckets + policies (D-31), Realtime.
-- pg_cron runs in UTC; Manila = UTC+8 (no DST). Times below are documented in Manila time.
-- =============================================================================

-- End-of-day job (D-21, FR-146): for the previous Manila work date, insert 'absent' for active
-- scheduled employees with no record (skipping holidays/non-work days), and close open records
-- as 'incomplete'. Idempotent: safe to run twice.
create or replace function public.run_end_of_day(p_work_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := coalesce(p_work_date, public.manila_today() - 1);
  v_absent int;
  v_incomplete int;
  v_rec public.attendance_records;
  v_c record;
begin
  perform public.set_audit_context('end_of_day_job');

  insert into public.attendance_records (employee_id, work_date, status, method, notes)
  select p.id, v_date, 'absent', 'qr', null
  from public.profiles p
  where p.role = 'employee' and p.status = 'active'
    and public.is_work_day(p.id, v_date)
    and (p.approved_at is null or (p.approved_at at time zone 'Asia/Manila')::date <= v_date)
  on conflict (employee_id, work_date) do nothing;
  get diagnostics v_absent = row_count;

  v_incomplete := 0;
  for v_rec in
    select * from public.attendance_records ar
    where ar.work_date = v_date and ar.time_in is not null and ar.time_out is null
      and ar.status <> 'incomplete'
    for update
  loop
    select * into v_c from public.compute_attendance_status(v_rec.employee_id, v_date, v_rec.time_in, null, true);
    update public.attendance_records
    set status = v_c.status, minutes_late = v_c.minutes_late, undertime_minutes = 0
    where id = v_rec.id;
    perform public.notify_user(v_rec.employee_id, 'record_incomplete', 'No time-out recorded',
      'You have no time-out for ' || to_char(v_date, 'Mon DD, YYYY') ||
      '. Please file a correction request so your DTR is complete.');
    v_incomplete := v_incomplete + 1;
  end loop;

  return jsonb_build_object('work_date', v_date, 'absent_inserted', v_absent,
    'incomplete_flagged', v_incomplete);
exception when others then
  perform public.log_error_internal('edge_function', 'critical', 'End-of-day job failed: ' || sqlerrm,
    jsonb_build_object('job', 'end_of_day', 'work_date', v_date));
  raise;
end;
$$;

-- Kiosk offline detection (D-34, FR-110): every minute.
create or replace function public.detect_offline_kiosks()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval int := (select a.heartbeat_interval_seconds from public.app_settings a where a.id = 1);
  v_station record;
  v_count int := 0;
begin
  for v_station in
    update public.stations s set is_online = false
    where s.is_online and s.is_active
      and (s.last_seen_at is null or s.last_seen_at < now() - make_interval(secs => 3 * v_interval))
    returning s.id, s.name, s.last_seen_at
  loop
    perform public.log_error_internal('kiosk', 'critical',
      'Kiosk offline: ' || v_station.name || ' missed 3 heartbeats',
      jsonb_build_object('station_id', v_station.id, 'last_seen_at', v_station.last_seen_at));
    perform public.notify_admins('kiosk_offline', 'Kiosk offline',
      v_station.name || ' has not sent a heartbeat since ' ||
      coalesce(to_char(v_station.last_seen_at at time zone 'Asia/Manila', 'HH24:MI'), 'it was set up') || '.');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Hourly nonce cleanup (FR-147, D-32).
create or replace function public.cleanup_nonces()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.qr_nonces where issued_at < now() - interval '1 day';
  delete from public.qr_nonce_uses where used_at < now() - interval '1 day';
$$;

-- Weekly periodic verification (FR-149): unbound devices, missing schedules, anomalies, stale
-- accounts. Results go to admins as one notification and to error_logs (info) for history.
create or replace function public.run_periodic_verification()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report jsonb;
begin
  select jsonb_build_object(
    'active_without_device', (select count(*) from public.profiles p
      where p.role = 'employee' and p.status = 'active'
        and not exists (select 1 from public.devices d where d.employee_id = p.id and d.revoked_at is null)),
    'active_without_schedule', (select count(*) from public.profiles p
      where p.role = 'employee' and p.status = 'active'
        and (select s.id from public.schedule_for(p.id, public.manila_today()) s) is null),
    'scan_anomalies_7d', (select count(*) from public.error_logs e
      where e.context ->> 'kind' = 'scan_anomaly' and e.created_at > now() - interval '7 days'),
    'failed_scans_7d', (select count(*) from public.scan_attempts sa
      where not sa.success and sa.created_at > now() - interval '7 days'),
    'stale_pending_30d', (select count(*) from public.profiles p
      where p.status = 'pending' and p.created_at < now() - interval '30 days'),
    'active_no_scan_60d', (select count(*) from public.profiles p
      where p.role = 'employee' and p.status = 'active' and p.approved_at < now() - interval '60 days'
        and not exists (select 1 from public.scan_attempts sa where sa.employee_id = p.id
          and sa.success and sa.created_at > now() - interval '60 days'))
  ) into v_report;

  perform public.log_error_internal('edge_function', 'info', 'Weekly periodic verification report',
    jsonb_build_object('job', 'periodic_verification', 'report', v_report));
  perform public.notify_admins('periodic_verification', 'Weekly verification report',
    format('No phone: %s · No schedule: %s · Scan anomalies: %s · Failed scans: %s · Stale pending: %s · No scans in 60 days: %s',
      v_report ->> 'active_without_device', v_report ->> 'active_without_schedule',
      v_report ->> 'scan_anomalies_7d', v_report ->> 'failed_scans_7d',
      v_report ->> 'stale_pending_30d', v_report ->> 'active_no_scan_60d'));
  return v_report;
end;
$$;

-- Daily retention (D-32). Storage objects are removed through storage.objects rows.
create or replace function public.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selfie_days int := (select a.selfie_retention_days from public.app_settings a where a.id = 1);
  v_result jsonb := '{}'::jsonb;
  v_n int;
begin
  perform set_config('app.retention', 'on', true);
  perform public.set_audit_context('retention_job');

  -- Storage files are deleted by the storage-cleanup Edge Function (Storage API), which reads
  -- storage_purge_candidates() before this job clears the database references.
  update public.scan_attempts set selfie_path = null
  where selfie_path is not null and created_at < now() - make_interval(days => v_selfie_days);

  delete from public.kiosk_heartbeats where created_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('kiosk_heartbeats', v_n);
  delete from public.error_logs where created_at < now() - interval '180 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('error_logs', v_n);
  delete from public.notifications where created_at < now() - interval '1 year';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('notifications', v_n);
  delete from public.scan_attempts where created_at < now() - interval '1 year';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('scan_attempts', v_n);

  delete from public.correction_requests where created_at < now() - interval '5 years';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('correction_requests', v_n);
  delete from public.attendance_records where work_date < public.manila_today() - interval '5 years';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('attendance_records', v_n);
  delete from public.audit_logs where created_at < now() - interval '5 years';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('audit_logs', v_n);

  -- Rejected registrations: 90 days after review (D-32). Deleting auth.users cascades.
  delete from auth.users u
  using public.profiles p
  where p.id = u.id and p.status = 'rejected' and p.approved_at < now() - interval '90 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('rejected_accounts', v_n);

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (null, 'retention_job', 'retention', null, v_result);
  return v_result;
end;
$$;

-- Files whose retention has ended (D-32). Read by the storage-cleanup Edge Function, which deletes
-- them through the Storage API (direct deletes from storage.objects are blocked by Supabase).
create or replace function public.storage_purge_candidates()
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id = 'selfies'
    and o.created_at < now() - make_interval(days => (select a.selfie_retention_days from public.app_settings a where a.id = 1))
  union all
  select 'correction-attachments', cr.attachment_url from public.correction_requests cr
  where cr.attachment_url is not null and cr.created_at < now() - interval '5 years'
  union all
  select 'profile-photos', p.photo_url from public.profiles p
  where p.photo_url is not null and p.status = 'rejected' and p.approved_at < now() - interval '90 days'
  limit 1000;
$$;

revoke execute on function public.storage_purge_candidates() from public, anon, authenticated;

revoke execute on function public.run_end_of_day(date), public.detect_offline_kiosks(),
  public.cleanup_nonces(), public.run_periodic_verification(), public.run_retention()
  from public, anon, authenticated;

-- Schedules (UTC). Manila = UTC+8.
select cron.schedule('bhw-end-of-day', '5 20 * * *', $$select public.run_end_of_day()$$);          -- 04:05 Manila
select cron.schedule('bhw-offline-kiosks', '* * * * *', $$select public.detect_offline_kiosks()$$);  -- every minute
select cron.schedule('bhw-nonce-cleanup', '0 * * * *', $$select public.cleanup_nonces()$$);          -- hourly
select cron.schedule('bhw-periodic-verification', '0 22 * * 0', $$select public.run_periodic_verification()$$); -- Mon 06:00 Manila
select cron.schedule('bhw-retention', '30 18 * * *', $$select public.run_retention()$$);            -- 02:30 Manila
-- 02:15 Manila: storage files first, so run_retention can then drop their database references.
-- Needs Vault secrets 'project_url' and 'service_role_key' (docs/phase-3-backend/README.md).
select cron.schedule('bhw-storage-cleanup', '15 18 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/storage-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key')
$$);

-- -----------------------------------------------------------------------------
-- Storage (D-31). Buckets are also declared in config.toml for local dev; created here so a
-- hosted project gets them through `supabase db push`.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('selfies', 'selfies', false, 2097152, array['image/jpeg', 'image/webp']),
  ('correction-attachments', 'correction-attachments', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Owners upload into their own folder (<user_id>/...).
create policy storage_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('profile-photos', 'selfies', 'correction-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- Owners read their own files (signed URLs are created through this policy).
create policy storage_owner_select on storage.objects for select to authenticated
  using (
    bucket_id in ('profile-photos', 'selfies', 'correction-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- Owners replace their own profile photo.
create policy storage_owner_update_photo on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Admin reads every private file (approvals, corrections, selfie review).
create policy storage_admin_select on storage.objects for select to authenticated
  using (bucket_id in ('profile-photos', 'selfies', 'correction-attachments') and public.is_admin());

-- -----------------------------------------------------------------------------
-- Realtime (FR-97): live dashboard, kiosk feed and station status.
-- RLS applies to postgres_changes, so each client only receives rows it may select.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.attendance_records, public.stations,
  public.correction_requests, public.notifications, public.scan_attempts;
