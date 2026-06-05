alter table public.charges
add column if not exists reminder_sent_at timestamptz;
