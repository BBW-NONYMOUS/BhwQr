-- Test helpers shared by the pgTAP files (created in a schema that only exists in test runs).
begin;
select plan(1);

create schema if not exists tests;

-- Impersonate a user the way PostgREST does (auth.uid() reads request.jwt.claims.sub).
create or replace function tests.login_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.logout()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Creates an active employee with the seeded regular schedule and a bound device hash 'b'*64.
create or replace function tests.make_employee(p_id uuid, p_bhw text)
returns uuid language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    lower(p_bhw) || '@test.local', 'x', now(), '{"provider":"email"}',
    jsonb_build_object('full_name', 'Test ' || p_bhw, 'bhw_id_number', p_bhw, 'area', 'Purok Test',
      'contact_number', '09170000000', 'consent', true), now(), now());
  update public.profiles set status = 'active', approved_at = now() - interval '30 days',
    approved_by = '00000000-0000-4000-a000-000000000001' where id = p_id;
  insert into public.employee_schedules (employee_id, schedule_id, effective_from)
  values (p_id, '20000000-0000-4000-a000-000000000001', public.manila_today() - 30);
  insert into public.devices (employee_id, device_id_hash, platform, model)
  values (p_id, repeat('b', 63) || right(replace(p_id::text, '-', ''), 1), 'android', 'Test Phone');
  return p_id;
end;
$$;

select pass('test helpers created');
select * from finish();
commit;
