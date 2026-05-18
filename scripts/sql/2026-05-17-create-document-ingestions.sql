create table if not exists public.inbound_mailboxes (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    local_part text not null unique,
    email_address text not null unique,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create unique index if not exists inbound_mailboxes_owner_idx
on public.inbound_mailboxes (owner_id);

create table if not exists public.document_ingestions (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    source_type text not null
        check (source_type in ('EMAIL', 'UPLOAD')),
    source_message_id text,
    source_email_from text,
    source_email_subject text,
    source_attachment_name text,
    storage_bucket text not null default 'documents',
    storage_key text not null,
    status text not null
        check (status in ('RECEIVED', 'EXTRACTED', 'NEEDS_REVIEW', 'DRAFTED', 'FAILED', 'PUBLISHED')),
    extracted_data jsonb,
    normalized_data jsonb,
    confidence numeric(5,4),
    error_message text,
    created_charge_id uuid references public.charges(id) on delete set null,
    created_document_id uuid references public.documents(id) on delete set null,
    created_at timestamptz not null default now(),
    processed_at timestamptz
);

create index if not exists document_ingestions_owner_created_idx
on public.document_ingestions (owner_id, created_at desc);

create table if not exists public.document_fingerprints (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    sha256 text not null,
    invoice_number text,
    issuer_name text,
    gross_amount numeric(12,2),
    due_date date,
    document_id uuid references public.documents(id) on delete set null,
    created_at timestamptz not null default now()
);

create unique index if not exists document_fingerprints_owner_sha_idx
on public.document_fingerprints (owner_id, sha256);
