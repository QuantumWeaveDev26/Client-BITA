-- Technician phone app (D-016): technicians have no login. The office creates a one-time 6-digit
-- pairing code for a technician; the Android app exchanges it once for a device secret and from then
-- on calls the server's /api/field/* routes with that secret. Only hashes of codes and secrets are stored.
-- These tables are written only by the server (service role); office staff can see and revoke devices.

alter table public.assignments add column started_at timestamptz;  -- technician tapped "Start work"

create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  code_hash text not null unique,              -- sha256 of the 6-digit code
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.people (id),
  created_at timestamptz not null default now()
);

create table public.technician_devices (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  device_name text,
  secret_hash text not null unique,            -- sha256 of the device secret the app holds
  push_token text,                             -- for "new job assigned" notifications
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create index technician_devices_person_idx on public.technician_devices (person_id);

alter table public.pairing_codes enable row level security;
alter table public.technician_devices enable row level security;

-- Office and management see codes and linked phones, and can revoke a phone (set revoked_at).
create policy staff_read on public.pairing_codes for select to authenticated using (private.is_staff());
create policy staff_read on public.technician_devices for select to authenticated using (private.is_staff());
create policy staff_revoke on public.technician_devices for update to authenticated
  using (private.has_role('management') or private.has_role('office'))
  with check (private.has_role('management') or private.has_role('office'));

revoke update on public.technician_devices from authenticated;
grant update (revoked_at) on public.technician_devices to authenticated;
