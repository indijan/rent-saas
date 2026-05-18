create table if not exists public.property_import_aliases (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    alias_text text not null,
    normalized_alias text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists property_import_aliases_owner_normalized_idx
on public.property_import_aliases (owner_id, normalized_alias);

create index if not exists property_import_aliases_property_created_idx
on public.property_import_aliases (property_id, created_at desc);
