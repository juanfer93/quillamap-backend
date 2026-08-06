-- Security heatmap contract support.
-- Keeps public heatmap reads anonymous while making PostGIS clustering cheap.

create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$
begin
  alter type report_type_enum add value if not exists 'inseguridad';
exception when undefined_object then
  null;
end $$;

alter table if exists report
  add column if not exists danger_level smallint not null default 1;

alter table if exists report
  add column if not exists intensity double precision,
  add column if not exists veracity_score double precision,
  add column if not exists expires_at timestamp;

do $$
begin
  alter table report
    add constraint report_danger_level_check
    check (danger_level between 1 and 5);
exception when duplicate_object then null;
end $$;

create index if not exists idx_report_location_gist
  on report using gist (location);

do $$
begin
  alter table report
    add constraint report_intensity_check
    check (intensity is null or (intensity >= 0 and intensity <= 1));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table report
    add constraint report_veracity_score_check
    check (veracity_score is null or (veracity_score >= 0 and veracity_score <= 1));
exception when duplicate_object then null;
end $$;

create index if not exists idx_report_security_heatmap_recent
  on report (type, status, "createdAt" desc)
  where type = 'inseguridad';

create index if not exists idx_report_validations_report_negative
  on report_validations ("reportId", "isConfirmed")
  where "isConfirmed" = false;

create index if not exists idx_profile_karma
  on profile (karma);

create index if not exists idx_zones_boundary_gist
  on zones using gist (boundary);

create table if not exists traffic_cameras (
  id uuid primary key default gen_random_uuid(),
  external_id varchar,
  name varchar,
  infrastructure_type varchar default 'traffic_camera',
  location geography(Point, 4326),
  verified boolean default true,
  verification_score double precision default 1,
  metadata jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table if exists traffic_cameras
  add column if not exists external_id varchar,
  add column if not exists name varchar,
  add column if not exists infrastructure_type varchar default 'traffic_camera',
  add column if not exists location geography(Point, 4326),
  add column if not exists verified boolean default true,
  add column if not exists verification_score double precision default 1,
  add column if not exists metadata jsonb,
  add column if not exists "createdAt" timestamptz not null default now(),
  add column if not exists "updatedAt" timestamptz not null default now();

update traffic_cameras
set external_id = coalesce(external_id, metadata->>'externalId', 'legacy-' || id::text)
where external_id is null;

update traffic_cameras
set
  name = coalesce(name, 'Camara sin nombre'),
  infrastructure_type = coalesce(infrastructure_type, 'traffic_camera'),
  verified = coalesce(verified, true),
  verification_score = coalesce(verification_score, 1);

do $$
begin
  alter table traffic_cameras alter column external_id set not null;
  alter table traffic_cameras alter column name set not null;
  alter table traffic_cameras alter column infrastructure_type set not null;
  alter table traffic_cameras alter column verified set not null;
  alter table traffic_cameras alter column verification_score set not null;
exception when undefined_table then null;
end $$;

do $$
begin
  alter table traffic_cameras
    add constraint traffic_cameras_verification_score_check
    check (verification_score >= 0 and verification_score <= 1);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table traffic_cameras
    add constraint traffic_cameras_location_srid_check
    check (location is null or ST_SRID(location::geometry) = 4326);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table traffic_cameras
    add constraint traffic_cameras_infrastructure_type_check
    check (infrastructure_type in ('traffic_camera', 'cultural_landmark'));
exception when duplicate_object then null;
end $$;

create unique index if not exists traffic_cameras_external_id_unique_idx
  on traffic_cameras (external_id);

create index if not exists idx_traffic_cameras_location_gist
  on traffic_cameras using gist (location);

create index if not exists idx_traffic_cameras_verified
  on traffic_cameras (verified, verification_score);
