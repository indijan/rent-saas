with expected_functions as (
    select * from (values
        ('public', 'app_is_admin'),
        ('public', 'app_has_role')
    ) as f(schema_name, function_name)
),
function_status as (
    select
        ef.schema_name,
        ef.function_name,
        exists (
            select 1
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = ef.schema_name
              and p.proname = ef.function_name
        ) as exists_in_db
    from expected_functions ef
),
expected_tables as (
    select * from (values
        ('public', 'profiles'),
        ('public', 'properties'),
        ('public', 'charges'),
        ('public', 'documents'),
        ('public', 'owner_memberships'),
        ('public', 'tenant_memberships')
    ) as t(schema_name, table_name)
),
table_status as (
    select
        et.schema_name,
        et.table_name,
        c.relrowsecurity as rowsecurity_enabled
    from expected_tables et
    join pg_class c on c.relname = et.table_name
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = et.schema_name
),
expected_policies as (
    select * from (values
        ('public', 'profiles', 'profiles_select_access'),
        ('public', 'profiles', 'profiles_update_self_or_admin'),
        ('public', 'owner_memberships', 'owner_memberships_select_access'),
        ('public', 'tenant_memberships', 'tenant_memberships_select_access'),
        ('public', 'tenant_memberships', 'tenant_memberships_owner_insert'),
        ('public', 'tenant_memberships', 'tenant_memberships_owner_update'),
        ('public', 'tenant_memberships', 'tenant_memberships_owner_delete'),
        ('public', 'properties', 'properties_select_access'),
        ('public', 'properties', 'properties_owner_insert'),
        ('public', 'properties', 'properties_owner_update'),
        ('public', 'properties', 'properties_owner_delete'),
        ('public', 'charges', 'charges_select_access'),
        ('public', 'charges', 'charges_owner_insert'),
        ('public', 'charges', 'charges_owner_update'),
        ('public', 'charges', 'charges_tenant_archive_paid'),
        ('public', 'charges', 'charges_owner_delete'),
        ('public', 'documents', 'documents_select_access'),
        ('public', 'documents', 'documents_owner_insert'),
        ('public', 'documents', 'documents_owner_update'),
        ('public', 'documents', 'documents_owner_delete')
    ) as p(schema_name, table_name, policy_name)
),
actual_policies as (
    select
        schemaname as schema_name,
        tablename as table_name,
        policyname as policy_name
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'properties', 'charges', 'documents', 'owner_memberships', 'tenant_memberships')
),
missing_policies as (
    select
        ep.schema_name,
        ep.table_name,
        ep.policy_name
    from expected_policies ep
    left join actual_policies ap
      on ap.schema_name = ep.schema_name
     and ap.table_name = ep.table_name
     and ap.policy_name = ep.policy_name
    where ap.policy_name is null
),
extra_policies as (
    select
        ap.schema_name,
        ap.table_name,
        ap.policy_name
    from actual_policies ap
    left join expected_policies ep
      on ep.schema_name = ap.schema_name
     and ep.table_name = ap.table_name
     and ep.policy_name = ap.policy_name
    where ep.policy_name is null
)
select *
from (
    select 'functions' as section, row_to_json(function_status) as payload
    from function_status
    union all
    select 'tables', row_to_json(table_status)
    from table_status
    union all
    select 'missing_policies', row_to_json(missing_policies)
    from missing_policies
    union all
    select 'extra_policies', row_to_json(extra_policies)
    from extra_policies
) audit_rows
order by section, payload::text;
