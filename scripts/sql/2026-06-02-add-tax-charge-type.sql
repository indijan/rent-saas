do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.charges'::regclass
      and conname = 'charges_type_check'
  ) then
    alter table public.charges drop constraint charges_type_check;
  end if;
end $$;

alter table public.charges
add constraint charges_type_check
check (type in ('RENT', 'UTILITY', 'INSURANCE', 'COMMON_COST', 'RENOVATION', 'TAX', 'OTHER'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_profiles'::regclass
      and conname = 'supplier_profiles_default_charge_type_check'
  ) then
    alter table public.supplier_profiles drop constraint supplier_profiles_default_charge_type_check;
  end if;
end $$;

alter table public.supplier_profiles
add constraint supplier_profiles_default_charge_type_check
check (default_charge_type in ('RENT', 'UTILITY', 'INSURANCE', 'COMMON_COST', 'RENOVATION', 'TAX', 'OTHER'));
