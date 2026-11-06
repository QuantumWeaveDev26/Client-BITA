-- Technicians log into the BITA web app (BITA, 6 Nov: no separate portal; replaces R21; D-015).
-- A technician sees only their own assignments and the jobs those belong to, and can enter field data, photos
-- and messages for those jobs. Technicians never see quotations, invoices, reminders, enquiries or the correction log
-- (those tables have no technician policy).

-- The per-job phone-link tokens are no longer used.
alter table public.assignments drop column link_token_hash, drop column link_expires_at;

create function private.my_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from people where user_id = auth.uid() and active;
$$;

-- True when the logged-in user is assigned to this job. Takes text so storage paths can be checked too.
create function private.is_assigned_to_job(job text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a
    where a.job_id::text = job and a.person_id = (select id from people where user_id = auth.uid() and active)
  );
$$;

revoke all on function private.my_person_id(), private.is_assigned_to_job(text) from public, anon;
grant execute on function private.my_person_id(), private.is_assigned_to_job(text) to authenticated, service_role;

-- Own record and own qualifications.
create policy technician_read_self on public.people for select to authenticated
  using (user_id = auth.uid());
create policy technician_read_own_qualifications on public.qualifications for select to authenticated
  using (person_id = private.my_person_id());

-- Equipment list, to see what is assigned.
create policy technician_read_equipment on public.equipment for select to authenticated
  using (private.has_role('technician'));

-- Own assignments: read, and mark acknowledged or completed (other columns are protected by the trigger below).
create policy technician_read_assignments on public.assignments for select to authenticated
  using (person_id = private.my_person_id());
create policy technician_update_assignments on public.assignments for update to authenticated
  using (person_id = private.my_person_id()) with check (person_id = private.my_person_id());
create policy technician_read_assignment_equipment on public.assignment_equipment for select to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment_id and a.person_id = private.my_person_id()));

create function private.check_assignment_update() returns trigger
language plpgsql set search_path = public, private as $$
begin
  if not is_staff()
     and (new.job_id, new.person_id, new.work_date) is distinct from (old.job_id, old.person_id, old.work_date) then
    raise exception 'A technician can only acknowledge or complete an assignment';
  end if;
  return new;
end;
$$;

create trigger assignments_technician_update before update on public.assignments
  for each row execute function private.check_assignment_update();

-- Jobs and customers of their assignments (no prices live in these tables).
create policy technician_read_jobs on public.jobs for select to authenticated
  using (private.is_assigned_to_job(id::text));
create policy technician_read_customers on public.customers for select to authenticated
  using (exists (select 1 from public.jobs j where j.customer_id = customers.id and private.is_assigned_to_job(j.id::text)));

-- Field data, photos and drawings for their jobs.
create policy technician_read_inspections on public.inspections for select to authenticated
  using (private.is_assigned_to_job(job_id::text));
create policy technician_write_inspections on public.inspections for insert to authenticated
  with check (private.is_assigned_to_job(job_id::text) and submitted_by = private.my_person_id());
create policy technician_update_inspections on public.inspections for update to authenticated
  using (private.is_assigned_to_job(job_id::text)) with check (private.is_assigned_to_job(job_id::text));
create policy technician_read_attachments on public.attachments for select to authenticated
  using (private.is_assigned_to_job(job_id::text));
create policy technician_write_attachments on public.attachments for insert to authenticated
  with check (private.is_assigned_to_job(job_id::text) and uploaded_by = private.my_person_id());

-- Delays, leave, equipment and site issues (X1, inside the app).
create policy technician_read_messages on public.technician_messages for select to authenticated
  using (person_id = private.my_person_id());
create policy technician_write_messages on public.technician_messages for insert to authenticated
  with check (person_id = private.my_person_id());
create policy staff_write_messages on public.technician_messages for insert to authenticated
  with check (private.is_staff());

-- Files: technicians read and upload under documents/jobs/<job id>/ for their own jobs.
create policy technician_read_job_files on storage.objects for select to authenticated
  using (bucket_id = 'documents' and split_part(name, '/', 1) = 'jobs' and private.is_assigned_to_job(split_part(name, '/', 2)));
create policy technician_write_job_files on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and split_part(name, '/', 1) = 'jobs' and private.is_assigned_to_job(split_part(name, '/', 2)));
