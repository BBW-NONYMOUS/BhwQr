-- Every employee has a profile photo (BR-12a).
-- 1. set_my_photo: the signed-in employee links a file they uploaded to their own folder in
--    `profile-photos` (storage_owner_insert already limits uploads to <user_id>/...). Works for
--    pending and active employees, so a photo can be added after registration or replaced later
--    (FR-18) without the service-role key.
-- 2. approve_employee refuses a registration without a photo (PHOTO_REQUIRED).

create or replace function public.set_my_photo(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.id is null or v_profile.role <> 'employee' or v_profile.status not in ('pending', 'active') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_path is null or p_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_REQUEST' using errcode = '22023', detail = 'photo_path';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'profile-photos' and o.name = p_path
  ) then
    raise exception 'NOT_FOUND';
  end if;

  perform public.set_audit_context('set_my_photo');
  update public.profiles set photo_url = p_path where id = v_uid;
end;
$$;

revoke all on function public.set_my_photo(text) from public, anon;
grant execute on function public.set_my_photo(text) to authenticated;

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
  if v_profile.photo_url is null or btrim(v_profile.photo_url) = '' then
    raise exception 'PHOTO_REQUIRED';
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
