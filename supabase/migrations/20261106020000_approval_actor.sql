-- Approvals must be made by the logged-in person themselves (found in review of T8):
-- before this, office staff could record any reviewer's id as the approver.
-- The server (service role, no logged-in user) is still trusted for background work.

create or replace function private.check_report() returns trigger
language plpgsql set search_path = public, private as $$
declare
  insp record;
  approving boolean := new.approved_at is not null
    and (tg_op = 'INSERT' or new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by);
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
  if new.approved_at is not null and not (person_has_role(new.approved_by, 'reviewer') or person_has_role(new.approved_by, 'management')) then
    raise exception 'Only a technical reviewer can approve a report';
  end if;
  -- A logged-in user can approve only as themselves.
  if approving and auth.uid() is not null and new.approved_by is distinct from my_person_id() then
    raise exception 'You can approve a report only as yourself';
  end if;
  -- An approved report is frozen; return it first to change its content.
  if tg_op = 'UPDATE' and old.approved_at is not null and new.approved_at is not null and auth.uid() is not null
     and (new.content, new.method, new.report_no, new.inspection_id) is distinct from (old.content, old.method, old.report_no, old.inspection_id) then
    raise exception 'An approved report cannot be edited; return it to the technician first';
  end if;
  -- Only a reviewer or management can withdraw an approval (return a report).
  if tg_op = 'UPDATE' and old.approved_at is not null and new.approved_at is null and auth.uid() is not null
     and not (has_role('reviewer') or has_role('management')) then
    raise exception 'Only a technical reviewer can return an approved report';
  end if;
  return new;
end;
$$;

create or replace function private.check_quotation_approval() returns trigger
language plpgsql set search_path = public, private as $$
declare
  approving boolean := new.approved_at is not null
    and (tg_op = 'INSERT' or new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by);
begin
  if new.status in ('approved', 'sent', 'accepted') and new.approved_at is null then
    raise exception 'Quotation % must be approved before it is %', new.ref_no, new.status;
  end if;
  if new.approved_at is not null and not person_has_role(new.approved_by, 'management') then
    raise exception 'Only management can approve a quotation';
  end if;
  if approving and auth.uid() is not null and new.approved_by is distinct from my_person_id() then
    raise exception 'You can approve a quotation only as yourself';
  end if;
  return new;
end;
$$;

revoke all on function private.check_report(), private.check_quotation_approval() from public, anon;
grant execute on function private.check_report(), private.check_quotation_approval() to authenticated, service_role;
