do $$
declare
    supplier_constraint text;
    charge_constraint text;
begin
    select conname into supplier_constraint
    from pg_constraint
    where conrelid = 'public.supplier_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%default_charge_type%'
      and pg_get_constraintdef(oid) ilike '%RENT%'
      and pg_get_constraintdef(oid) ilike '%UTILITY%';

    if supplier_constraint is not null then
        execute format('alter table public.supplier_profiles drop constraint %I', supplier_constraint);
    end if;

    alter table public.supplier_profiles
    add constraint supplier_profiles_default_charge_type_check
    check (default_charge_type in ('RENT', 'UTILITY', 'INSURANCE', 'COMMON_COST', 'RENOVATION', 'OTHER'));

    select conname into charge_constraint
    from pg_constraint
    where conrelid = 'public.charges'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
      and pg_get_constraintdef(oid) ilike '%RENT%'
      and pg_get_constraintdef(oid) ilike '%UTILITY%';

    if charge_constraint is not null then
        execute format('alter table public.charges drop constraint %I', charge_constraint);
    end if;
exception
    when undefined_table then
        null;
end $$;

alter table public.charges
add constraint charges_type_check
check (type in ('RENT', 'UTILITY', 'INSURANCE', 'COMMON_COST', 'RENOVATION', 'OTHER'));
