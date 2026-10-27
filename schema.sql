-- Run in Supabase SQL Editor before deployment.
create table if not exists public.event_registrations (
  id bigint generated always as identity primary key,
  full_name text not null check (length(full_name) between 3 and 90),
  phone text not null unique,
  role text not null check (role in ('investor','manager','specialist','operator','founder','other')),
  company text,
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','contacted','confirmed')),
  created_at timestamptz not null default now()
);
create index if not exists event_registrations_created_at_idx on public.event_registrations (created_at desc);
-- With RLS enabled and no public policies, anonymous clients cannot read the records.
-- API uses SUPABASE_SERVICE_ROLE_KEY on the SERVER ONLY.
alter table public.event_registrations enable row level security;
