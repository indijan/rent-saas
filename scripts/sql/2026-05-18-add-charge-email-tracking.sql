alter table public.charges
add column if not exists overdue_check_sent_at timestamptz;

alter table public.charges
add column if not exists manual_reminder_sent_at timestamptz;
