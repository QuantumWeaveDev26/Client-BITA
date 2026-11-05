-- BITA Business Management System: first schema.
-- Covers BITA's requirements document of 5 Nov 2026 (R1–R41, X1–X4). Owner: Naveen (AGENTS.md rule 3).
-- Money rule (AGENTS.md rule 4): Zoho Books is the source of truth. The invoices table is a mirror only;
-- GST is never calculated here.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('management', 'office', 'reviewer', 'technician');

create type public.test_method as enum (
  'UT', 'MPT', 'DPT', 'RT', 'VT', 'hardness', 'metallography', 'RLA', 'certification', 'general_inspection'
);

create type public.job_status as enum (
  'enquiry_received', 'awaiting_approval', 'scheduled', 'inspection_done',
  'report_in_review', 'report_sent', 'invoiced', 'closed'
);

create type public.enquiry_source as enum ('email', 'phone', 'whatsapp');
create type public.enquiry_status as enum ('new', 'linked', 'quoted', 'converted', 'closed');
create type public.quotation_status as enum ('draft', 'approved', 'sent', 'accepted', 'superseded');
create type public.report_status as enum ('draft', 'in_review', 'returned', 'approved', 'sent');
create type public.invoice_kind as enum ('proforma', 'tax_invoice');
create type public.equipment_kind as enum ('ut_flaw_detector', 'mpi_yoke');
create type public.technician_message_kind as enum (
  'acknowledgement', 'completion', 'delay', 'leave', 'equipment_problem', 'site_issue', 'other'
);

-- ---------------------------------------------------------------------------
-- People, qualifications, equipment (R19–R21, R29–R31, R40)
-- ---------------------------------------------------------------------------

-- Everyone at BITA. Only management and reviewers log in (user_id set); technicians have no login (R21).
create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  initials text unique,                         -- as used in BITA's job log: AT, SR, RR, VSK
  position text,
  mobile text,                                  -- WhatsApp number for technicians (X1)
  email text,
  user_id uuid unique references auth.users (id) on delete set null,
  roles public.app_role[] not null default '{}',
  signature_path text,                          -- storage path; applied to reports only after approval (R27)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  method public.test_method not null,
  level text not null,                          -- e.g. 'Level II', 'Level 2'
  scheme text,                                  -- e.g. 'ASNT SNT-TC-1A', 'EN ISO 9712', 'ISNT'
  certifying_body text,
  certificate_no text,
  issued_on date,
  valid_until date,
  certificate_path text,
  created_at timestamptz not null default now()
);

create index qualifications_person_method_idx on public.qualifications (person_id, method);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  kind public.equipment_kind not null,
  make text,
  model text,
  serial_no text unique,                        -- MPI yoke serials still to come from BITA (R31)
  calibrated_on date,
  calibration_due date,
  certificate_path text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers and enquiries (R2–R7)
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,                             -- short code used in report numbers, e.g. TDPS
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  billing_address text,
  uses_proforma boolean not null default false, -- TDPS only today (R33, R34)
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  mailbox text,                                 -- BITA mailbox that handles this customer (R2, R36)
  zoho_contact_id text unique,
  notes text,
  created_at timestamptz not null default now()
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  mobile text,
  email text,
  notes text,
  receives_reports boolean not null default false,
  receives_invoices boolean not null default false,
  created_at timestamptz not null default now()
);

create index customer_contacts_customer_idx on public.customer_contacts (customer_id);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  source public.enquiry_source not null,
  external_id text unique,                      -- mail or WhatsApp message id, so a message is captured once
  mailbox text,
  received_at timestamptz not null default now(),
  from_name text,
  from_address text,                            -- email address or phone number
  subject text,
  body text,
  extracted jsonb not null default '{}',        -- customer, component, test type read from the message
  customer_id uuid references public.customers (id),
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

create index enquiries_customer_idx on public.enquiries (customer_id);

-- ---------------------------------------------------------------------------
-- Quotations (R8–R13). No rate list and no expiry: prices are entered per quotation.
-- ---------------------------------------------------------------------------

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,                           -- BITA format, e.g. 027-2026
  customer_id uuid not null references public.customers (id),
  enquiry_id uuid references public.enquiries (id),
  quote_date date not null default current_date,
  attention text,
  subject text,
  terms text,
  status public.quotation_status not null default 'draft',
  approved_by uuid references public.people (id),
  approved_at timestamptz,
  pdf_path text,
  superseded_by uuid references public.quotations (id),
  created_at timestamptz not null default now()
);

create index quotations_customer_idx on public.quotations (customer_id);

-- One line per priced item. Kept searchable so past rates can be found (R9).
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  position integer not null default 1,
  description text not null,
  basis text,                                   -- e.g. 'per shaft', 'per ring', 'per visit'
  rate numeric(12, 2),
  minimum_charge numeric(12, 2),
  notes text
);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- ---------------------------------------------------------------------------
-- Jobs (R1, R14–R18)
-- ---------------------------------------------------------------------------

create table public.job_counters (
  financial_year text primary key,              -- '26-27'
  last_no integer not null
);

-- Next Job ID in the format BITA/YY-YY/0001, numbered per April–March financial year (Asia/Kolkata).
-- Format pending BITA's confirmation (their Section 5, item 11).
create function public.next_job_no() returns text
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  start_year integer := extract(year from today)::integer - case when extract(month from today) < 4 then 1 else 0 end;
  fy text := lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');
  n integer;
begin
  insert into job_counters as c (financial_year, last_no) values (fy, 1)
  on conflict (financial_year) do update set last_no = c.last_no + 1
  returning last_no into n;
  return 'BITA/' || fy || '/' || lpad(n::text, 4, '0');
end;
$$;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text not null unique default public.next_job_no(),
  customer_id uuid not null references public.customers (id),
  enquiry_id uuid references public.enquiries (id),
  quotation_id uuid references public.quotations (id),  -- an approved quotation may be reused for repeat work (R13)
  po_number text,                               -- not required before work starts (R14)
  po_date date,
  po_path text,
  site text,
  scope text,
  test_methods public.test_method[] not null default '{}',
  status public.job_status not null default 'enquiry_received',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index jobs_customer_idx on public.jobs (customer_id);
create index jobs_status_idx on public.jobs (status);

-- ---------------------------------------------------------------------------
-- Technician work over WhatsApp (X1, R20, R21)
-- ---------------------------------------------------------------------------

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  person_id uuid not null references public.people (id),
  work_date date not null,
  notes text,
  notified_at timestamptz,                      -- daily assignment sent on WhatsApp
  acknowledged_at timestamptz,
  completed_at timestamptz,
  link_token_hash text unique,                  -- per-job phone link for readings; only the hash is stored
  link_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index assignments_person_date_idx on public.assignments (person_id, work_date);

create table public.assignment_equipment (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id),
  primary key (assignment_id, equipment_id)
);

-- Messages technicians send on WhatsApp: acknowledgements, delays, leave, equipment and site issues.
create table public.technician_messages (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  person_id uuid references public.people (id),
  job_id uuid references public.jobs (id),
  assignment_id uuid references public.assignments (id),
  kind public.technician_message_kind not null default 'other',
  body text,
  media_paths text[] not null default '{}',
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Field data and reports (R22–R28, X2)
-- ---------------------------------------------------------------------------

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  assignment_id uuid references public.assignments (id),
  method public.test_method not null,
  readings jsonb not null default '{}',         -- fields per method, BITA Table 4.4
  observations text,
  submitted_by uuid references public.people (id),
  submitted_at timestamptz,
  missing_fields text[] not null default '{}',  -- mandatory readings not yet given (X2)
  created_at timestamptz not null default now()
);

create index inspections_job_idx on public.inspections (job_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  inspection_id uuid references public.inspections (id),
  method public.test_method not null,
  report_no text not null unique,               -- BITA's own number, kept as is (R16)
  report_date date not null default current_date,
  content jsonb not null default '{}',
  status public.report_status not null default 'draft',
  prepared_by uuid references public.people (id),
  reviewed_by uuid references public.people (id),
  approved_by uuid references public.people (id),
  approved_at timestamptz,
  signatory_id uuid references public.people (id),  -- S. Radhakrishnan by default (R26)
  pdf_path text,
  sent_at timestamptz,
  sent_to text[] not null default '{}',
  created_at timestamptz not null default now(),
  -- The signed PDF exists only after approval (R27), and nothing is sent unapproved (AGENTS.md rule 6).
  constraint reports_pdf_after_approval check (pdf_path is null or approved_at is not null),
  constraint reports_sent_after_approval check (sent_at is null or approved_at is not null)
);

create index reports_job_idx on public.reports (job_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  inspection_id uuid references public.inspections (id),
  report_id uuid references public.reports (id),
  kind text not null check (kind in (
    'site_photo', 'defect_photo', 'drawing', 'purchase_order', 'supporting_document', 'other'
  )),
  storage_path text not null,
  caption text,
  uploaded_by uuid references public.people (id),
  uploaded_at timestamptz not null default now()
);

create index attachments_job_idx on public.attachments (job_id);

-- ---------------------------------------------------------------------------
-- Zoho Books mirror and reminders (R32–R38). Written only by the Zoho sync (service role).
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id),
  kind public.invoice_kind not null,
  zoho_id text not null unique,
  number text,
  invoice_date date,
  due_date date,
  total numeric(14, 2),
  balance numeric(14, 2),
  status text,                                  -- as reported by Zoho Books
  customer_po_number text,                      -- TDPS issues a PO against the proforma (R33)
  reminders_paused boolean not null default false,  -- management can pause or stop reminders (R37)
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- One GST invoice per job: check before creating one in Zoho (AGENTS.md rule 5).
create unique index invoices_one_tax_invoice_per_job on public.invoices (job_id) where kind = 'tax_invoice';

create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  scheduled_for date not null,
  kind text not null check (kind in ('before_due', 'on_due', 'overdue')),
  from_mailbox text,
  sent_to text[] not null default '{}',
  sent_at timestamptz,
  unique (invoice_id, scheduled_for)
);

-- ---------------------------------------------------------------------------
-- Correction log (R28, X3): every change keeps the old and new values, who and when.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_fields text[] not null default '{}',
  old_row jsonb,
  new_row jsonb,
  changed_by_user uuid,                         -- logged-in user, if any
  changed_by_person uuid,                       -- technician via phone link, set by the server as app.actor_person_id
  changed_at timestamptz not null default now(),
  management_notified_at timestamptz            -- set when management has been told about a correction (X3)
);

create index audit_log_record_idx on public.audit_log (table_name, record_id);

create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  fields text[];
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into fields
    from jsonb_each(new_j) n
    where n.value is distinct from old_j -> n.key;
    if fields = '{}' then
      return new;
    end if;
  end if;

  insert into audit_log (table_name, record_id, action, changed_fields, old_row, new_row,
                         changed_by_user, changed_by_person)
  values (tg_table_name, coalesce(new_j ->> 'id', old_j ->> 'id')::uuid, lower(tg_op), coalesce(fields, '{}'),
          old_j, new_j, auth.uid(), nullif(current_setting('app.actor_person_id', true), '')::uuid);

  return coalesce(new, old);
end;
$$;

create trigger audit_inspections after insert or update or delete on public.inspections
  for each row execute function public.audit_row();
create trigger audit_reports after insert or update or delete on public.reports
  for each row execute function public.audit_row();
create trigger audit_quotations after insert or update or delete on public.quotations
  for each row execute function public.audit_row();
create trigger audit_quotation_items after insert or update or delete on public.quotation_items
  for each row execute function public.audit_row();
create trigger audit_jobs after insert or update or delete on public.jobs
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Role checks
-- ---------------------------------------------------------------------------

create function public.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where user_id = auth.uid() and active and r = any (roles));
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from people
    where user_id = auth.uid() and active and roles && array['management', 'office', 'reviewer']::app_role[]
  );
$$;

create function public.person_has_role(p uuid, r public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where id = p and active and r = any (roles));
$$;

-- Only management approves quotations (R10).
create function public.check_quotation_approval() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status in ('approved', 'sent', 'accepted') and new.approved_at is null then
    raise exception 'Quotation % must be approved before it is %', new.ref_no, new.status;
  end if;
  if new.approved_at is not null and not person_has_role(new.approved_by, 'management') then
    raise exception 'Only management can approve a quotation';
  end if;
  return new;
end;
$$;

create trigger quotations_approval before insert or update on public.quotations
  for each row execute function public.check_quotation_approval();

-- Reports: approved only by a technical reviewer (R26, AGENTS.md rule 6), and prepared only from
-- complete, submitted field data (R25, X2).
create function public.check_report() returns trigger
language plpgsql set search_path = public as $$
declare
  insp record;
begin
  if new.inspection_id is not null then
    select submitted_at, missing_fields into insp from inspections where id = new.inspection_id;
    if insp.submitted_at is null then
      raise exception 'Field data for this report has not been submitted';
    end if;
    if cardinality(insp.missing_fields) > 0 then
      raise exception 'Mandatory readings missing: %', array_to_string(insp.missing_fields, ', ');
    end if;
  end if;
  if new.status in ('approved', 'sent') and new.approved_at is null then
    raise exception 'Report % must be approved before it is %', new.report_no, new.status;
  end if;
  if new.approved_at is not null and not person_has_role(new.approved_by, 'reviewer') then
    raise exception 'Only a technical reviewer can approve a report';
  end if;
  return new;
end;
$$;

create trigger reports_checks before insert or update on public.reports
  for each row execute function public.check_report();

-- Qualification with an expiry flag, shown when assigning a job (R20).
create view public.qualification_status with (security_invoker = true) as
  select q.*, (q.valid_until is not null and q.valid_until < current_date) as is_expired
  from public.qualifications q;

-- ---------------------------------------------------------------------------
-- Row Level Security (AGENTS.md rule 7). Roles are enforced here, not only in the UI.
-- Tables without a write policy are written only by the server with the service role
-- (Zoho sync, WhatsApp intake, technician phone links).
-- ---------------------------------------------------------------------------

alter table public.people enable row level security;
alter table public.qualifications enable row level security;
alter table public.equipment enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.enquiries enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.job_counters enable row level security;
alter table public.jobs enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_equipment enable row level security;
alter table public.technician_messages enable row level security;
alter table public.inspections enable row level security;
alter table public.reports enable row level security;
alter table public.attachments enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.audit_log enable row level security;

-- Read: any logged-in BITA staff member.
create policy staff_read on public.people for select to authenticated using (public.is_staff());
create policy staff_read on public.qualifications for select to authenticated using (public.is_staff());
create policy staff_read on public.equipment for select to authenticated using (public.is_staff());
create policy staff_read on public.customers for select to authenticated using (public.is_staff());
create policy staff_read on public.customer_contacts for select to authenticated using (public.is_staff());
create policy staff_read on public.enquiries for select to authenticated using (public.is_staff());
create policy staff_read on public.quotations for select to authenticated using (public.is_staff());
create policy staff_read on public.quotation_items for select to authenticated using (public.is_staff());
create policy staff_read on public.jobs for select to authenticated using (public.is_staff());
create policy staff_read on public.assignments for select to authenticated using (public.is_staff());
create policy staff_read on public.assignment_equipment for select to authenticated using (public.is_staff());
create policy staff_read on public.technician_messages for select to authenticated using (public.is_staff());
create policy staff_read on public.inspections for select to authenticated using (public.is_staff());
create policy staff_read on public.reports for select to authenticated using (public.is_staff());
create policy staff_read on public.attachments for select to authenticated using (public.is_staff());

-- Money and the correction log: management and office only.
create policy billing_read on public.invoices for select to authenticated
  using (public.has_role('management') or public.has_role('office'));
create policy billing_read on public.payment_reminders for select to authenticated
  using (public.has_role('management') or public.has_role('office'));
create policy management_read on public.audit_log for select to authenticated
  using (public.has_role('management'));

-- Pausing reminders is the one change management makes to the invoice mirror (R37).
create policy management_pause_reminders on public.invoices for update to authenticated
  using (public.has_role('management')) with check (public.has_role('management'));

-- Write: people, qualifications and equipment by management.
create policy management_write on public.people for all to authenticated
  using (public.has_role('management')) with check (public.has_role('management'));
create policy management_write on public.qualifications for all to authenticated
  using (public.has_role('management')) with check (public.has_role('management'));
create policy management_write on public.equipment for all to authenticated
  using (public.has_role('management')) with check (public.has_role('management'));

-- Write: day-to-day records by management and office.
create policy office_write on public.customers for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.customer_contacts for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.enquiries for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.quotations for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.quotation_items for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.jobs for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.assignments for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.assignment_equipment for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.inspections for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));
create policy office_write on public.attachments for all to authenticated
  using (public.has_role('management') or public.has_role('office'))
  with check (public.has_role('management') or public.has_role('office'));

-- Write: reports by management, office and reviewers; approval itself is checked by check_report().
create policy report_write on public.reports for all to authenticated
  using (public.has_role('management') or public.has_role('office') or public.has_role('reviewer'))
  with check (public.has_role('management') or public.has_role('office') or public.has_role('reviewer'));

-- Management may change only the pause flag on the invoice mirror; everything else comes from Zoho.
revoke update on public.invoices from authenticated;
grant update (reminders_paused) on public.invoices to authenticated;
