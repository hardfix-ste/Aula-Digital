-- AULA DIGITAL - esquema inicial v1
-- Ejecutar una sola vez en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table public.institutions (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null unique,
    address text,
    city text,
    province text,
    email text,
    phone text,
    logo_url text,
    status text not null default 'active'
      check (status in ('active','suspended')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references auth.users(id),
    institution_id uuid references public.institutions(id),
    action text not null,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.institutions enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, update, delete on public.institutions to authenticated;
grant select, insert on public.audit_logs to authenticated;

create policy "institutions_select"
on public.institutions for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  or id::text = (auth.jwt() -> 'app_metadata' ->> 'institution_id')
);

create policy "institutions_insert"
on public.institutions for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

create policy "institutions_update"
on public.institutions for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

create policy "institutions_delete"
on public.institutions for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

create policy "audit_select"
on public.audit_logs for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  or institution_id::text = (auth.jwt() -> 'app_metadata' ->> 'institution_id')
);

create policy "audit_insert"
on public.audit_logs for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    or institution_id::text = (auth.jwt() -> 'app_metadata' ->> 'institution_id')
  )
);

create index institutions_status_idx on public.institutions(status);
create index audit_logs_actor_idx on public.audit_logs(actor_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
