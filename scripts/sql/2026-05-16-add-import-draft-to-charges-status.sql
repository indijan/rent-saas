alter table public.charges
drop constraint if exists charges_status_check;

alter table public.charges
add constraint charges_status_check
check (
    status in (
        'IMPORT_DRAFT',
        'UNPAID',
        'PAID',
        'ARCHIVED',
        'CANCELLED'
    )
);
