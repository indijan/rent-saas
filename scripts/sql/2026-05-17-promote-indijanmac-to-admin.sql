update public.profiles
set role = 'ADMIN'
where email = 'indijanmac@gmail.com';

insert into public.owner_memberships (user_id)
select id
from public.profiles
where email = 'indijanmac@gmail.com'
on conflict (user_id) do nothing;
