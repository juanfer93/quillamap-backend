create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'place_category_enum') then
    create type place_category_enum as enum ('servicios', 'transporte', 'comida', 'compras', 'salud');
  end if;
end $$;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  "osmId" varchar unique,
  name jsonb not null,
  description jsonb,
  category place_category_enum not null,
  location geography(Point, 4326) not null,
  metadata jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists places_location_gist_idx
  on public.places
  using gist (location);

create table if not exists public.tourist_sites (
  id uuid primary key default gen_random_uuid(),
  "osmId" varchar unique,
  name jsonb not null,
  description jsonb,
  category place_category_enum not null default 'servicios',
  location geography(Point, 4326) not null,
  metadata jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table if exists public.tourist_sites
  add column if not exists "osmId" varchar;

alter table if exists public.tourist_sites
  add column if not exists description jsonb;

alter table if exists public.tourist_sites
  add column if not exists category place_category_enum not null default 'servicios';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tourist_sites'
      and column_name = 'category'
      and udt_name <> 'place_category_enum'
  ) then
    alter table public.tourist_sites
      alter column category drop default;

    alter table public.tourist_sites
      alter column category type place_category_enum
      using (
        case
          when category::text in ('servicios', 'transporte', 'comida', 'compras', 'salud') then category::text
          else 'servicios'
        end
      )::place_category_enum;

    alter table public.tourist_sites
      alter column category set default 'servicios';
  end if;
end $$;

alter table if exists public.tourist_sites
  add column if not exists metadata jsonb;

alter table if exists public.tourist_sites
  add column if not exists "createdAt" timestamptz not null default now();

alter table if exists public.tourist_sites
  add column if not exists "updatedAt" timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tourist_sites'
      and column_name = 'name'
      and data_type <> 'jsonb'
  ) then
    alter table public.tourist_sites
      alter column name type jsonb
      using jsonb_build_object('es', name::text, 'en', name::text);
  end if;
end $$;

create unique index if not exists tourist_sites_osm_id_unique_idx
  on public.tourist_sites ("osmId")
  where "osmId" is not null;

create index if not exists tourist_sites_location_gist_idx
  on public.tourist_sites
  using gist (location);

alter table public.places enable row level security;
alter table public.tourist_sites enable row level security;

drop policy if exists "places_public_read" on public.places;
create policy "places_public_read"
  on public.places
  for select
  using (true);

drop policy if exists "tourist_sites_public_read" on public.tourist_sites;
create policy "tourist_sites_public_read"
  on public.tourist_sites
  for select
  using (true);
