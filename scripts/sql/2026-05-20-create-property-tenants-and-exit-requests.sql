create table if not exists public.property_tenants (
    property_id uuid not null references public.properties(id) on delete cascade,
    tenant_id uuid not null references public.profiles(id) on delete cascade,
    owner_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (property_id, tenant_id)
);

create index if not exists property_tenants_tenant_idx
on public.property_tenants (tenant_id);

create index if not exists property_tenants_owner_idx
on public.property_tenants (owner_id);

insert into public.property_tenants (property_id, tenant_id, owner_id)
select p.id, p.tenant_id, p.owner_id
from public.properties p
where p.tenant_id is not null
on conflict (property_id, tenant_id) do nothing;

create table if not exists public.tenant_exit_requests (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.profiles(id) on delete cascade,
    owner_id uuid not null references public.profiles(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    status text not null default 'PENDING'
        check (status in ('PENDING', 'APPROVED', 'REJECTED')),
    note text,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz
);

create unique index if not exists tenant_exit_requests_pending_unique
on public.tenant_exit_requests (tenant_id, property_id)
where status = 'PENDING';
