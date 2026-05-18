alter table public.supplier_profiles
add column if not exists default_property_id uuid references public.properties(id) on delete set null;

create index if not exists supplier_profiles_owner_default_property_idx
on public.supplier_profiles (owner_id, default_property_id);
