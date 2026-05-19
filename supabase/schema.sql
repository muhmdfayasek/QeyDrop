create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

alter extension pgcrypto set schema extensions;
alter extension pg_trgm set schema extensions;

revoke all on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
revoke all on schema extensions from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

create table if not exists public.collections (
  id uuid primary key default extensions.gen_random_uuid(),
  keyword text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists collections_keyword_unique_idx
  on public.collections (lower(keyword));

create index if not exists collections_created_at_idx
  on public.collections (created_at desc);

create index if not exists collections_keyword_trgm_idx
  on public.collections using gin (keyword extensions.gin_trgm_ops);

create table if not exists public.links (
  id uuid primary key default extensions.gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  label text not null,
  url text not null
);

create index if not exists links_collection_id_idx
  on public.links (collection_id);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

alter table public.collections enable row level security;
alter table public.links enable row level security;
alter table public.collections force row level security;
alter table public.links force row level security;

grant select on public.collections to anon;
grant select on public.links to anon;

drop policy if exists "anon can read collections" on public.collections;
drop policy if exists "Allow public read collections" on public.collections;
create policy "Allow public read collections"
  on public.collections
  for select
  to anon
  using (true);

drop policy if exists "anon can read links" on public.links;
drop policy if exists "Allow public read links" on public.links;
create policy "Allow public read links"
  on public.links
  for select
  to anon
  using (true);

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated, public';
  end if;
end
$$;
