create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  charge_id uuid references public.charges(id) on delete set null,
  category text not null,
  template_key text,
  recipient_role text not null default 'TENANT',
  recipient_email text not null,
  subject text not null,
  provider text not null default 'AWS_SES',
  provider_message_id text,
  status text not null default 'PENDING',
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_event_at timestamptz not null default now(),
  error_message text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_logs_owner_created_idx
on public.email_delivery_logs (owner_id, recipient_role, created_at desc);

create index if not exists email_delivery_logs_message_id_idx
on public.email_delivery_logs (provider_message_id);

create index if not exists email_delivery_logs_charge_idx
on public.email_delivery_logs (charge_id);
