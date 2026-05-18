create unique index if not exists document_ingestions_email_owner_storage_idx
on public.document_ingestions (owner_id, storage_key)
where source_type = 'EMAIL';
