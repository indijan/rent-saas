-- Backfill legacy tenant ownership metadata before the application stops
-- scanning every Auth user on normal owner-page requests.
insert into public.tenant_memberships (user_id, owner_id)
select
    u.id,
    owner_profile.id
from auth.users as u
join public.profiles as owner_profile
  on owner_profile.id = case
      when (u.raw_app_meta_data ->> 'owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (u.raw_app_meta_data ->> 'owner_id')::uuid
      else null::uuid
  end
where (u.raw_app_meta_data ->> 'owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (user_id, owner_id) do nothing;

create index if not exists tenant_memberships_owner_user_idx
    on public.tenant_memberships (owner_id, user_id);

create index if not exists property_tenants_owner_tenant_idx
    on public.property_tenants (owner_id, tenant_id);

create index if not exists properties_tenant_id_idx
    on public.properties (tenant_id);

create index if not exists charges_owner_due_date_idx
    on public.charges (owner_id, due_date);

create index if not exists charges_owner_status_due_date_idx
    on public.charges (owner_id, status, due_date);

create index if not exists charges_property_due_date_idx
    on public.charges (property_id, due_date);

create index if not exists documents_owner_charge_idx
    on public.documents (owner_id, charge_id);

create index if not exists documents_charge_created_idx
    on public.documents (charge_id, created_at desc);

create index if not exists tenant_exit_requests_owner_status_created_idx
    on public.tenant_exit_requests (owner_id, status, created_at desc);

create index if not exists profiles_email_idx
    on public.profiles (email);
