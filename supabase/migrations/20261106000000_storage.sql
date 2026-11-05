-- File storage. All buckets are private: files are reached only by logged-in BITA staff or by the server.
--   documents: POs, site and defect photos, drawings, certificate copies, supporting documents
--   branding:  BITA logo, company seal and signatures (applied to reports only after approval, R27)
--   reports:   final signed report PDFs and quotation PDFs

insert into storage.buckets (id, name, public) values
  ('documents', 'documents', false),
  ('branding', 'branding', false),
  ('reports', 'reports', false)
on conflict (id) do nothing;

create policy staff_read_files on storage.objects for select to authenticated
  using (bucket_id in ('documents', 'branding', 'reports') and private.is_staff());

create policy staff_write_documents on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.is_staff());
create policy staff_update_documents on storage.objects for update to authenticated
  using (bucket_id = 'documents' and private.is_staff())
  with check (bucket_id = 'documents' and private.is_staff());

-- Signatures and seal: management only.
create policy management_write_branding on storage.objects for all to authenticated
  using (bucket_id = 'branding' and private.has_role('management'))
  with check (bucket_id = 'branding' and private.has_role('management'));

-- Report PDFs are written by the server after approval; staff only read them.
