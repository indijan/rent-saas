create table if not exists public.supplier_profiles (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    issuer_name text not null,
    issuer_fingerprint text not null,
    default_charge_type text
        check (default_charge_type in ('RENT', 'UTILITY', 'COMMON_COST', 'OTHER')),
    currency_hint text,
    field_rules_json jsonb not null default '{}'::jsonb,
    is_global boolean not null default false,
    created_at timestamptz not null default now()
);

create unique index if not exists supplier_profiles_owner_fingerprint_idx
on public.supplier_profiles (owner_id, issuer_fingerprint);

create table if not exists public.extraction_reviews (
    id uuid primary key default gen_random_uuid(),
    ingestion_id uuid not null references public.document_ingestions(id) on delete cascade,
    reviewed_by uuid not null references public.profiles(id) on delete cascade,
    raw_extraction_json jsonb not null,
    final_extraction_json jsonb not null,
    notes text,
    created_at timestamptz not null default now()
);
