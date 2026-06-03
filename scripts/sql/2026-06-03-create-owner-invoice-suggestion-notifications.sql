create table if not exists public.owner_invoice_suggestion_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  suggestion_key text not null,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(owner_id, suggestion_key)
);

create index if not exists owner_invoice_suggestion_notifications_owner_idx
on public.owner_invoice_suggestion_notifications (owner_id, last_sent_at desc);
