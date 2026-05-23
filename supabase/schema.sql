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

create table if not exists public.admin_account (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique,
  email text not null unique,
  created_at timestamptz not null default now()
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
revoke all on table public.admin_account from public, anon, authenticated;

alter table public.collections enable row level security;
alter table public.links enable row level security;
alter table public.collections force row level security;
alter table public.links force row level security;

create or replace function public.configure_admin_account(admin_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(btrim(admin_email));
  configured_user_id uuid;
begin
  if normalized_email = '' then
    raise exception 'Admin email is required';
  end if;

  select users.id
  into configured_user_id
  from auth.users as users
  where lower(users.email) = normalized_email
  limit 1;

  if configured_user_id is null then
    raise exception 'No auth user exists for %', normalized_email;
  end if;

  insert into public.admin_account (singleton, user_id, email)
  values (true, configured_user_id, normalized_email)
  on conflict (singleton) do update
    set user_id = excluded.user_id,
        email = excluded.email;

  return configured_user_id;
end;
$$;

revoke all on function public.configure_admin_account(text) from public, anon, authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_account as admin_account
    where admin_account.singleton = true
      and admin_account.user_id = auth.uid()
      and admin_account.email = lower(btrim(coalesce(auth.jwt()->>'email', '')))
  );
$$;

revoke all on function public.is_admin_user() from public, anon, authenticated;
grant execute on function public.is_admin_user() to anon, authenticated;

create or replace function public.is_admin_login_user(
  p_user_id uuid,
  p_email text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_account as admin_account
    where admin_account.singleton = true
      and admin_account.user_id = p_user_id
      and admin_account.email = lower(btrim(coalesce(p_email, '')))
  );
$$;

revoke all on function public.is_admin_login_user(uuid, text) from public, anon, authenticated;
grant execute on function public.is_admin_login_user(uuid, text) to anon, authenticated;

create or replace function public.save_collection(
  p_collection_id uuid,
  p_keyword text,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  normalized_keyword text := btrim(coalesce(p_keyword, ''));
  normalized_links jsonb := coalesce(p_links, '[]'::jsonb);
  saved_collection_id uuid;
begin
  if normalized_keyword = '' then
    raise exception 'Keyword is required';
  end if;

  if jsonb_typeof(normalized_links) <> 'array' then
    raise exception 'Links payload must be a JSON array';
  end if;

  if jsonb_array_length(normalized_links) = 0 then
    raise exception 'At least one link is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(normalized_links) as link_item
    where jsonb_typeof(link_item) <> 'object'
      or btrim(coalesce(link_item->>'label', '')) = ''
      or btrim(coalesce(link_item->>'url', '')) = ''
  ) then
    raise exception 'Each link must include a label and a url';
  end if;

  if p_collection_id is null then
    insert into public.collections (keyword)
    values (normalized_keyword)
    returning id into saved_collection_id;
  else
    update public.collections
    set keyword = normalized_keyword
    where id = p_collection_id
    returning id into saved_collection_id;

    if saved_collection_id is null then
      raise exception 'Collection not found';
    end if;

    delete from public.links
    where collection_id = saved_collection_id;
  end if;

  insert into public.links (collection_id, label, url)
  select
    saved_collection_id,
    btrim(link_item->>'label'),
    btrim(link_item->>'url')
  from jsonb_array_elements(normalized_links) as link_item;

  return saved_collection_id;
end;
$$;

revoke all on function public.save_collection(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_collection(uuid, text, jsonb) to authenticated;

create or replace function public.delete_collection(p_collection_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.collections
  where id = p_collection_id;

  if not found then
    raise exception 'Collection not found';
  end if;
end;
$$;

revoke all on function public.delete_collection(uuid) from public, anon, authenticated;
grant execute on function public.delete_collection(uuid) to authenticated;

grant select on public.collections to anon, authenticated;
grant select on public.links to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;
grant insert, update, delete on public.links to authenticated;

drop policy if exists "anon can read collections" on public.collections;
drop policy if exists "Allow public read collections" on public.collections;
create policy "Allow public read collections"
  on public.collections
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow admin insert collections" on public.collections;
create policy "Allow admin insert collections"
  on public.collections
  for insert
  to authenticated
  with check (public.is_admin_user());

drop policy if exists "Allow admin update collections" on public.collections;
create policy "Allow admin update collections"
  on public.collections
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "Allow admin delete collections" on public.collections;
create policy "Allow admin delete collections"
  on public.collections
  for delete
  to authenticated
  using (public.is_admin_user());

drop policy if exists "anon can read links" on public.links;
drop policy if exists "Allow public read links" on public.links;
create policy "Allow public read links"
  on public.links
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow admin insert links" on public.links;
create policy "Allow admin insert links"
  on public.links
  for insert
  to authenticated
  with check (public.is_admin_user());

drop policy if exists "Allow admin update links" on public.links;
create policy "Allow admin update links"
  on public.links
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "Allow admin delete links" on public.links;
create policy "Allow admin delete links"
  on public.links
  for delete
  to authenticated
  using (public.is_admin_user());

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
