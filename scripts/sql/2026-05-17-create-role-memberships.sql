create table if not exists public.owner_memberships (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
    user_id uuid not null references public.profiles(id) on delete cascade,
    owner_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, owner_id)
);
