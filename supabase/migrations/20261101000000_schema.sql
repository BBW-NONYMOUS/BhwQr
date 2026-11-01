-- =============================================================================
-- BHW QR Attendance System – schema: extensions, enums, tables, constraints, indexes
-- Source of truth: docs/phase-1-system-analysis/08-erd.md and 09-data-dictionary.md
-- All attendance date logic is Asia/Manila (BR-01). Timestamps are timestamptz.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- -----------------------------------------------------------------------------
-- Enums (data dictionary §3)
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'employee', 'kiosk', 'viewer');
create type public.profile_status as enum ('pending', 'active', 'rejected', 'inactive');
create type public.attendance_status as enum ('on_time', 'late', 'absent', 'undertime', 'incomplete');
create type public.attendance_method as enum ('qr', 'fallback_personal_qr', 'manual', 'correction');
create type public.correction_type as enum ('missing_time_in', 'missing_time_out', 'wrong_time', 'official_business');
create type public.correction_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.error_source as enum ('edge_function', 'kiosk', 'mobile', 'web');
create type public.error_severity as enum ('info', 'warning', 'error', 'critical');
create type public.device_platform as enum ('android', 'ios');
create type public.notification_kind as enum (
  'registration_approved', 'registration_rejected', 'correction_approved', 'correction_rejected',
  'device_reset', 'record_incomplete', 'new_registration', 'new_correction_request',
  'kiosk_offline', 'periodic_verification'
);

-- -----------------------------------------------------------------------------
-- profiles (§5.1)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  bhw_id_number text unique check (char_length(bhw_id_number) between 3 and 30),
  area text check (char_length(area) <= 80),
  email text not null,
  contact_number_enc bytea,
  address_enc bytea,
  photo_url text check (photo_url ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  role public.user_role not null default 'employee',
  status public.profile_status not null default 'pending',
  rejection_reason text check (char_length(rejection_reason) <= 500),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_employee_has_bhw_id check (role <> 'employee' or bhw_id_number is not null),
  constraint profiles_employee_has_area check (role <> 'employee' or area is not null),
  constraint profiles_employee_consent check (role <> 'employee' or consent_at is not null),
  constraint profiles_rejection_reason check (
    status <> 'rejected' or char_length(btrim(rejection_reason)) >= 10
  ),
  constraint profiles_review_time check (approved_by is null or approved_at is not null)
);
create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_status_role_created_idx on public.profiles (status, role, created_at);
create index profiles_area_idx on public.profiles (area);
comment on table public.profiles is 'One row per auth user: identity, role, status. Contact number and address encrypted (D-29).';

-- -----------------------------------------------------------------------------
-- schedules (§5.2) and employee_schedules (§5.3)
-- -----------------------------------------------------------------------------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  work_days int[] not null,
  start_time time not null,
  end_time time not null,
  grace_minutes int not null default 15 check (grace_minutes between 0 and 60),
  break_start time not null default '12:00',
  break_end time not null default '13:00',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_time_order check (end_time > start_time),
  constraint schedules_break_inside check (
    break_start >= start_time and break_end <= end_time and break_end > break_start
  ),
  constraint schedules_work_days check (
    cardinality(work_days) >= 1 and work_days <@ array[1, 2, 3, 4, 5, 6, 7]
  )
);
comment on column public.schedules.work_days is 'ISO weekdays: 1 = Monday … 7 = Sunday (extract(isodow)).';

create table public.employee_schedules (
  employee_id uuid not null references public.profiles (id) on delete cascade,
  schedule_id uuid not null references public.schedules (id) on delete restrict,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  primary key (employee_id, effective_from),
  constraint employee_schedules_range check (effective_to is null or effective_to >= effective_from),
  constraint employee_schedules_no_overlap exclude using gist (
    employee_id with =,
    daterange(effective_from, effective_to, '[]') with &&
  )
);
create index employee_schedules_schedule_idx on public.employee_schedules (schedule_id);

-- -----------------------------------------------------------------------------
-- stations (§5.4), devices (§5.5)
-- -----------------------------------------------------------------------------
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  radius_m int check (radius_m is null or radius_m between 10 and 1000),
  is_active boolean not null default true,
  kiosk_user_id uuid unique references public.profiles (id) on delete set null,
  last_seen_at timestamptz,
  is_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stations_online_idx on public.stations (is_online, last_seen_at);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  device_id_hash text not null check (device_id_hash ~ '^[0-9a-f]{64}$'),
  platform public.device_platform not null,
  model text check (char_length(model) <= 100),
  bound_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint devices_revoked_after_bound check (revoked_at is null or revoked_at >= bound_at)
);
create unique index devices_one_active_per_employee on public.devices (employee_id) where revoked_at is null;
create unique index devices_one_active_per_hash on public.devices (device_id_hash) where revoked_at is null;
create index devices_employee_history_idx on public.devices (employee_id, bound_at desc);

-- -----------------------------------------------------------------------------
-- qr_nonces (§5.6), qr_nonce_uses (§5.7)
-- -----------------------------------------------------------------------------
create table public.qr_nonces (
  nonce uuid primary key,
  station_id uuid not null references public.stations (id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint qr_nonces_expiry check (expires_at > issued_at)
);
create index qr_nonces_station_issued_idx on public.qr_nonces (station_id, issued_at desc);
create index qr_nonces_issued_idx on public.qr_nonces (issued_at);

create table public.qr_nonce_uses (
  nonce uuid not null,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (nonce, employee_id)
);
create index qr_nonce_uses_used_idx on public.qr_nonce_uses (used_at);
comment on table public.qr_nonce_uses is 'Single use per employee (D-10). Also holds personal-QR nonces, so no FK to qr_nonces.';

-- -----------------------------------------------------------------------------
-- scan_attempts (§5.9) – created before attendance_records (FK target)
-- -----------------------------------------------------------------------------
create table public.scan_attempts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles (id) on delete set null,
  station_id uuid references public.stations (id) on delete set null,
  success boolean not null,
  error_code text check (
    error_code is null or error_code in (
      'AUTH_REQUIRED', 'RATE_LIMITED', 'INVALID_REQUEST', 'ACCOUNT_NOT_ACTIVE', 'DEVICE_NOT_BOUND',
      'DEVICE_MISMATCH', 'QR_INVALID', 'QR_EXPIRED', 'QR_UNKNOWN', 'QR_REUSED', 'STATION_INACTIVE',
      'GPS_INACCURATE', 'OUTSIDE_GEOFENCE', 'COOLDOWN_ACTIVE', 'ALREADY_COMPLETED', 'SELFIE_REQUIRED',
      'INTERNAL_ERROR'
    )
  ),
  failure_reason text check (char_length(failure_reason) <= 500),
  lat numeric(9, 6) check (lat is null or lat between -90 and 90),
  lng numeric(9, 6) check (lng is null or lng between -180 and 180),
  accuracy numeric(9, 2) check (accuracy is null or accuracy >= 0),
  device_id_hash text check (device_id_hash is null or device_id_hash ~ '^[0-9a-f]{64}$'),
  nonce uuid,
  selfie_path text,
  created_at timestamptz not null default now(),
  constraint scan_attempts_success_code check (success = (error_code is null))
);
create index scan_attempts_cooldown_idx on public.scan_attempts (employee_id, created_at desc) where success;
create index scan_attempts_employee_idx on public.scan_attempts (employee_id, created_at desc);
create index scan_attempts_station_idx on public.scan_attempts (station_id, created_at desc);
create index scan_attempts_created_idx on public.scan_attempts (created_at);
create index scan_attempts_employee_nonce_idx on public.scan_attempts (employee_id, nonce);

-- -----------------------------------------------------------------------------
-- attendance_records (§5.8)
-- -----------------------------------------------------------------------------
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete restrict,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  station_id uuid references public.stations (id) on delete restrict,
  status public.attendance_status not null,
  minutes_late int not null default 0 check (minutes_late >= 0),
  undertime_minutes int not null default 0 check (undertime_minutes >= 0),
  method public.attendance_method not null,
  notes text check (char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  time_in_scan_id uuid references public.scan_attempts (id) on delete set null,
  time_out_scan_id uuid references public.scan_attempts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  constraint attendance_time_in_required check (status = 'absent' or time_in is not null),
  constraint attendance_absent_no_times check (status <> 'absent' or (time_in is null and time_out is null)),
  constraint attendance_time_order check (time_out is null or time_out > time_in),
  constraint attendance_incomplete_no_out check (status <> 'incomplete' or time_out is null),
  constraint attendance_station_for_scans check (
    method not in ('qr', 'fallback_personal_qr') or station_id is not null
    or (status = 'absent' and created_by is null)
  ),
  constraint attendance_actor_for_admin_methods check (
    method not in ('fallback_personal_qr', 'manual', 'correction') or created_by is not null
  ),
  constraint attendance_manual_reason check (method <> 'manual' or char_length(btrim(notes)) >= 10)
);
create index attendance_date_status_idx on public.attendance_records (work_date, status);
create index attendance_station_date_idx on public.attendance_records (station_id, work_date);
create index attendance_open_idx on public.attendance_records (work_date)
  where time_in is not null and time_out is null;

-- -----------------------------------------------------------------------------
-- audit_logs (§5.10)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
comment on table public.audit_logs is 'Append-only change history (FR-126, FR-127). actor_id has no FK so history survives deletions.';

-- -----------------------------------------------------------------------------
-- holidays (§5.11), app_settings (§5.12)
-- -----------------------------------------------------------------------------
create table public.holidays (
  date date primary key,
  name text not null check (btrim(name) <> '' and char_length(name) <= 100),
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  geofence_radius_m int not null default 100 check (geofence_radius_m between 10 and 1000),
  max_gps_accuracy_m int not null default 50 check (max_gps_accuracy_m between 5 and 200),
  cooldown_minutes int not null default 5 check (cooldown_minutes between 1 and 60),
  token_lifetime_seconds int not null default 30 check (token_lifetime_seconds between 15 and 120),
  token_refresh_seconds int not null default 15 check (token_refresh_seconds between 5 and 60),
  selfie_required boolean not null default false,
  selfie_retention_days int not null default 30 check (selfie_retention_days between 1 and 365),
  overnight_cutoff_hour int not null default 4 check (overnight_cutoff_hour between 0 and 6),
  correction_window_days int not null default 5 check (correction_window_days between 0 and 15),
  heartbeat_interval_seconds int not null default 60 check (heartbeat_interval_seconds between 30 and 300),
  dtr_fill_break_times boolean not null default false,
  office_name text not null default 'Barangay Kalawag II Health Workers Office',
  office_address text not null default 'Barangay Kalawag II, Isulan, Sultan Kudarat',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint app_settings_refresh_lt_lifetime check (token_refresh_seconds < token_lifetime_seconds)
);
insert into public.app_settings (id) values (1);

-- -----------------------------------------------------------------------------
-- correction_requests (§5.13)
-- -----------------------------------------------------------------------------
create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete restrict,
  attendance_record_id uuid references public.attendance_records (id) on delete set null,
  work_date date not null,
  type public.correction_type not null,
  requested_time_in timestamptz,
  requested_time_out timestamptz,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  attachment_url text,
  status public.correction_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  remarks text check (char_length(remarks) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint correction_missing_in check (type <> 'missing_time_in' or requested_time_in is not null),
  constraint correction_missing_out check (type <> 'missing_time_out' or requested_time_out is not null),
  constraint correction_wrong_time check (
    type <> 'wrong_time' or requested_time_in is not null or requested_time_out is not null
  ),
  constraint correction_time_order check (
    requested_time_out is null or requested_time_in is null or requested_time_out > requested_time_in
  ),
  constraint correction_reviewed check (
    status not in ('approved', 'rejected') or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint correction_reject_remarks check (status <> 'rejected' or char_length(btrim(remarks)) >= 10)
);
create unique index correction_one_pending_per_day on public.correction_requests (employee_id, work_date)
  where status = 'pending';
create index correction_status_created_idx on public.correction_requests (status, created_at);
create index correction_employee_idx on public.correction_requests (employee_id, created_at desc);

-- -----------------------------------------------------------------------------
-- kiosk_heartbeats (§5.14), error_logs (§5.15), notifications (§5.16)
-- -----------------------------------------------------------------------------
create table public.kiosk_heartbeats (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  app_version text not null check (char_length(app_version) <= 20),
  clock_drift_ms int not null,
  last_token_at timestamptz,
  created_at timestamptz not null default now()
);
create index kiosk_heartbeats_station_idx on public.kiosk_heartbeats (station_id, created_at desc);
create index kiosk_heartbeats_created_idx on public.kiosk_heartbeats (created_at);

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  source public.error_source not null,
  severity public.error_severity not null,
  message text not null check (btrim(message) <> '' and char_length(message) <= 1000),
  context jsonb not null default '{}'::jsonb,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index error_logs_created_idx on public.error_logs (created_at desc);
create index error_logs_source_idx on public.error_logs (source, severity, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 1000),
  kind public.notification_kind not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- RLS on every table (FR-138). Policies are in the rls migration.
alter table public.profiles enable row level security;
alter table public.schedules enable row level security;
alter table public.employee_schedules enable row level security;
alter table public.stations enable row level security;
alter table public.devices enable row level security;
alter table public.qr_nonces enable row level security;
alter table public.qr_nonce_uses enable row level security;
alter table public.scan_attempts enable row level security;
alter table public.attendance_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.holidays enable row level security;
alter table public.app_settings enable row level security;
alter table public.correction_requests enable row level security;
alter table public.kiosk_heartbeats enable row level security;
alter table public.error_logs enable row level security;
alter table public.notifications enable row level security;
