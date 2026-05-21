create table if not exists public.idea_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  full_name text,
  role_context text not null default 'VISITOR' check (role_context in ('VISITOR', 'OWNER', 'TENANT', 'ADMIN')),
  source text not null default 'PUBLIC' check (source in ('PUBLIC', 'SIGNED_IN')),
  page_context text,
  feature_name text not null,
  description text not null,
  status text not null default 'NEW' check (status in ('NEW', 'REVIEWED', 'PLANNED', 'DONE', 'DISMISSED')),
  created_at timestamptz not null default now()
);

create index if not exists idea_submissions_created_at_idx
on public.idea_submissions (created_at desc);

create index if not exists idea_submissions_email_idx
on public.idea_submissions (email);
