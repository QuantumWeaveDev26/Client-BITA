-- Move helper and trigger functions out of the API-exposed public schema, so they cannot be called
-- through /rest/v1/rpc (Supabase security advisor 0028/0029). Policies, triggers and the jobs.job_no
-- default refer to the functions directly, so they keep working after the move.

create schema if not exists private;

alter function public.next_job_no() set schema private;
alter function public.audit_row() set schema private;
alter function public.has_role(public.app_role) set schema private;
alter function public.is_staff() set schema private;
alter function public.person_has_role(uuid, public.app_role) set schema private;
alter function public.check_quotation_approval() set schema private;
alter function public.check_report() set schema private;

-- The two check triggers call person_has_role() by name, so they need the new schema on their path.
alter function private.check_quotation_approval() set search_path = public, private;
alter function private.check_report() set search_path = public, private;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
