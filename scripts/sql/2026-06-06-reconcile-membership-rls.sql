create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'ADMIN'
    );
$$;

create or replace function public.app_has_role(target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case
        when target_role = 'ADMIN' then public.app_is_admin()
        when target_role = 'OWNER' then exists (
            select 1
            from public.owner_memberships om
            where om.user_id = auth.uid()
        )
        when target_role = 'TENANT' then exists (
            select 1
            from public.tenant_memberships tm
            where tm.user_id = auth.uid()
        )
        else false
    end;
$$;

revoke all on function public.app_is_admin() from public;
revoke all on function public.app_has_role(text) from public;
grant execute on function public.app_is_admin() to authenticated;
grant execute on function public.app_has_role(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.charges enable row level security;
alter table public.documents enable row level security;
alter table public.owner_memberships enable row level security;
alter table public.tenant_memberships enable row level security;

do $$
declare
    policy_row record;
begin
    for policy_row in
        select schemaname, tablename, policyname
        from pg_policies
        where (schemaname = 'public' and tablename in ('profiles', 'properties', 'charges', 'documents', 'owner_memberships', 'tenant_memberships'))
           or false
    loop
        execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    end loop;
end;
$$;

create policy "profiles_select_access"
on public.profiles
for select
to authenticated
using (
    public.app_is_admin()
    or auth.uid() = id
    or exists (
        select 1
        from public.tenant_memberships tm
        where tm.owner_id = auth.uid()
          and tm.user_id = profiles.id
    )
);

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
    public.app_is_admin()
    or auth.uid() = id
)
with check (
    public.app_is_admin()
    or auth.uid() = id
);

create policy "owner_memberships_select_access"
on public.owner_memberships
for select
to authenticated
using (
    public.app_is_admin()
    or auth.uid() = user_id
);

create policy "tenant_memberships_select_access"
on public.tenant_memberships
for select
to authenticated
using (
    public.app_is_admin()
    or auth.uid() = user_id
    or auth.uid() = owner_id
);

create policy "tenant_memberships_owner_insert"
on public.tenant_memberships
for insert
to authenticated
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "tenant_memberships_owner_update"
on public.tenant_memberships
for update
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
)
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "tenant_memberships_owner_delete"
on public.tenant_memberships
for delete
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "properties_select_access"
on public.properties
for select
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
    or (
        public.app_has_role('TENANT')
        and auth.uid() = tenant_id
    )
);

create policy "properties_owner_insert"
on public.properties
for insert
to authenticated
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "properties_owner_update"
on public.properties
for update
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
)
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "properties_owner_delete"
on public.properties
for delete
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "charges_select_access"
on public.charges
for select
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
    or (
        public.app_has_role('TENANT')
        and auth.uid() = tenant_id
    )
);

create policy "charges_owner_insert"
on public.charges
for insert
to authenticated
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "charges_owner_update"
on public.charges
for update
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
)
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "charges_tenant_archive_paid"
on public.charges
for update
to authenticated
using (
    public.app_has_role('TENANT')
    and auth.uid() = tenant_id
    and status = 'PAID'
)
with check (
    public.app_has_role('TENANT')
    and auth.uid() = tenant_id
    and status = 'ARCHIVED'
);

create policy "charges_owner_delete"
on public.charges
for delete
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "documents_select_access"
on public.documents
for select
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
    or (
        public.app_has_role('TENANT')
        and auth.uid() = tenant_id
    )
);

create policy "documents_owner_insert"
on public.documents
for insert
to authenticated
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "documents_owner_update"
on public.documents
for update
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
)
with check (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);

create policy "documents_owner_delete"
on public.documents
for delete
to authenticated
using (
    public.app_is_admin()
    or (
        public.app_has_role('OWNER')
        and auth.uid() = owner_id
    )
);
