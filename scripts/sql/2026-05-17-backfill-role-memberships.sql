insert into public.owner_memberships (user_id)
select p.id
from public.profiles p
where p.role = 'OWNER'
on conflict (user_id) do nothing;

insert into public.tenant_memberships (user_id, owner_id)
select distinct p.tenant_id, p.owner_id
from public.properties p
where p.tenant_id is not null
on conflict (user_id, owner_id) do nothing;

insert into public.tenant_memberships (user_id, owner_id)
select distinct c.tenant_id, c.owner_id
from public.charges c
where c.tenant_id is not null
on conflict (user_id, owner_id) do nothing;
