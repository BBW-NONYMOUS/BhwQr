-- =============================================================================
-- Audit trail (FR-126..FR-131). Triggers on every change to attendance_records, profiles,
-- devices, correction_requests, schedules, employee_schedules, stations, holidays, app_settings.
-- Encrypted columns are never copied: they appear as "[changed]" / "[unchanged]" (FR-130).
-- audit_logs is append-only (FR-127).
-- =============================================================================

create or replace function public.audit_redact(p_row jsonb, p_other jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_col text;
begin
  if p_row is null then
    return null;
  end if;
  foreach v_col in array array['contact_number_enc', 'address_enc'] loop
    if p_row ? v_col then
      p_row := jsonb_set(
        p_row, array[v_col],
        to_jsonb(case
          when p_row -> v_col = 'null'::jsonb then null
          when p_other is null or p_other -> v_col is distinct from p_row -> v_col then '[changed]'
          else '[unchanged]'
        end)
      );
    end if;
  end loop;
  return p_row;
end;
$$;

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_record_id text;
  v_actor uuid;
begin
  -- Heartbeat / offline-detection writes on stations would add ~1,440 rows a day per kiosk;
  -- they are not business changes (NFR-68 exception).
  if tg_table_name = 'stations' and tg_op = 'UPDATE'
     and (v_old - 'last_seen_at' - 'is_online' - 'updated_at')
       = (v_new - 'last_seen_at' - 'is_online' - 'updated_at') then
    return null;
  end if;

  v_record_id := case tg_table_name
    when 'holidays' then v_row ->> 'date'
    when 'app_settings' then v_row ->> 'id'
    when 'employee_schedules' then (v_row ->> 'employee_id') || '|' || (v_row ->> 'effective_from')
    else v_row ->> 'id'
  end;

  -- auth.uid() is the signed-in user for RPCs; Edge Functions using the service role pass the
  -- acting user through the app.actor_id setting (set_config inside record_scan etc.).
  v_actor := coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_actor,
    coalesce(nullif(current_setting('app.audit_action', true), ''), lower(tg_op)),
    tg_table_name,
    v_record_id,
    public.audit_redact(v_old, v_new),
    public.audit_redact(v_new, v_old)
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'attendance_records', 'profiles', 'devices', 'correction_requests', 'schedules',
    'employee_schedules', 'stations', 'holidays', 'app_settings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- Append-only guard. Only the retention job (running as postgres with app.retention = on) may
-- delete rows older than 5 years.
create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.retention', true) = 'on'
     and old.created_at < now() - interval '5 years' then
    return old;
  end if;
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_no_update_delete before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- Helper for RPCs: label the next audit rows with a business action name and reason.
create or replace function public.set_audit_context(p_action text, p_actor uuid default null)
returns void
language sql
set search_path = ''
as $$
  select set_config('app.audit_action', coalesce(p_action, ''), true),
         set_config('app.actor_id', coalesce(p_actor::text, ''), true);
$$;
revoke all on function public.set_audit_context(text, uuid) from public, anon, authenticated;
