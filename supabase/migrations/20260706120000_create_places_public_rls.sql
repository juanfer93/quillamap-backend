create extension if not exists postgis;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'place_category_enum') then
    create type place_category_enum as enum ('servicios', 'transporte', 'comida', 'compras', 'salud');
  end if;
end $$;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
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

alter table public.places enable row level security;

drop policy if exists "places_public_read" on public.places;
create policy "places_public_read"
  on public.places
  for select
  using (true);

do $$
begin
  if to_regclass('public.tourist_sites') is not null then
    execute 'alter table public.tourist_sites enable row level security';
    execute 'drop policy if exists "tourist_sites_public_read" on public.tourist_sites';
    execute 'create policy "tourist_sites_public_read" on public.tourist_sites for select using (true)';
  end if;
end $$;
