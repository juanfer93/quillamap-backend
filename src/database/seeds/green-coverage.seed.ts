import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import type { Geometry, LineString, Point, Polygon } from 'geojson';
import { GreenCoverageSource } from '@/features/thermal-comfort/entities/green-coverage-source.enum';
import { GreenCoverageType } from '@/features/thermal-comfort/entities/green-coverage-type.enum';

const DEFAULT_OVERPASS_JSON_PATH = 'data/amb-green-coverage.overpass.json';
const AMB_BOUNDS = {
  minLatitude: 10.82,
  maxLatitude: 11.12,
  minLongitude: -75.1,
  maxLongitude: -74.68,
} as const;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface SeedableGreenCoverage {
  osmId: string;
  type: GreenCoverageType;
  source: GreenCoverageSource;
  name: string | null;
  tags: Record<string, string>;
  geometry: Geometry;
}

interface GreenCoverageSeedSummary {
  inputPath: string;
  insertedOrUpdated: number;
  skipped: number;
  byType: Record<GreenCoverageType, number>;
}

const isFiniteLngLat = (coordinate: [number, number]): boolean => {
  const [longitude, latitude] = coordinate;

  return Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= AMB_BOUNDS.minLongitude &&
    longitude <= AMB_BOUNDS.maxLongitude &&
    latitude >= AMB_BOUNDS.minLatitude &&
    latitude <= AMB_BOUNDS.maxLatitude;
};

const toCoordinate = (point: { lat: number; lon: number }): [number, number] => [
  point.lon,
  point.lat,
];

const closeRing = (coordinates: [number, number][]): [number, number][] => {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (!first || !last || (first[0] === last[0] && first[1] === last[1])) {
    return coordinates;
  }

  return [...coordinates, first];
};

const getCoverageType = (tags: Record<string, string>): GreenCoverageType | null => {
  if (tags.natural === 'tree') {
    return GreenCoverageType.TREE;
  }

  if (tags.leisure === 'park') {
    return GreenCoverageType.PARK;
  }

  if (tags.landuse === 'grass') {
    return GreenCoverageType.GRASS;
  }

  return null;
};

const getPointGeometry = (element: OverpassElement): Point | null => {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  const coordinates: [number, number] = [longitude, latitude];

  return isFiniteLngLat(coordinates)
    ? { type: 'Point', coordinates }
    : null;
};

const getWayCoordinates = (
  element: OverpassElement,
  nodeCoordinatesById: Map<number, [number, number]>,
): [number, number][] => {
  if (element.geometry && element.geometry.length > 0) {
    return element.geometry.map(toCoordinate);
  }

  return element.nodes?.flatMap((nodeId) => {
    const coordinate = nodeCoordinatesById.get(nodeId);
    return coordinate ? [coordinate] : [];
  }) ?? [];
};

const getWayGeometry = (
  element: OverpassElement,
  nodeCoordinatesById: Map<number, [number, number]>,
): Polygon | LineString | null => {
  const coordinates = getWayCoordinates(element, nodeCoordinatesById).filter(isFiniteLngLat);

  if (coordinates.length < 2) {
    return null;
  }

  if (coordinates.length >= 3) {
    return {
      type: 'Polygon',
      coordinates: [closeRing(coordinates)],
    };
  }

  return {
    type: 'LineString',
    coordinates,
  };
};

export const toSeedableGreenCoverage = (
  data: OverpassResponse,
): { features: SeedableGreenCoverage[]; skipped: number } => {
  const elements = data.elements ?? [];
  const nodeCoordinatesById = new Map<number, [number, number]>();
  const features: SeedableGreenCoverage[] = [];
  let skipped = 0;

  for (const element of elements) {
    if (element.type !== 'node' || typeof element.lat !== 'number' || typeof element.lon !== 'number') {
      continue;
    }

    nodeCoordinatesById.set(element.id, [element.lon, element.lat]);
  }

  for (const element of elements) {
    const tags = element.tags ?? {};
    const type = getCoverageType(tags);

    if (!type) {
      continue;
    }

    const geometry = element.type === 'node'
      ? getPointGeometry(element)
      : getWayGeometry(element, nodeCoordinatesById);

    if (!geometry) {
      skipped += 1;
      continue;
    }

    features.push({
      osmId: `${element.type}/${element.id}`,
      type,
      source: GreenCoverageSource.OVERPASS,
      name: tags.name ?? tags['name:es'] ?? null,
      tags,
      geometry,
    });
  }

  return { features, skipped };
};

const ensureGreenCoverageSchema = async (dataSource: DataSource): Promise<void> => {
  await dataSource.query('create extension if not exists postgis');
  await dataSource.query('create extension if not exists pgcrypto');
  await dataSource.query(`
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'green_coverage_type_enum') then
        create type green_coverage_type_enum as enum ('tree', 'park', 'grass');
      end if;

      if not exists (select 1 from pg_type where typname = 'green_coverage_source_enum') then
        create type green_coverage_source_enum as enum ('overpass', 'community', 'official');
      end if;
    end $$
  `);
  await dataSource.query(`
    create table if not exists public.amb_green_coverage (
      id uuid primary key default gen_random_uuid(),
      "osmId" varchar,
      type green_coverage_type_enum not null,
      source green_coverage_source_enum not null default 'overpass',
      name varchar,
      tags jsonb,
      geometry geography(Geometry, 4326) not null,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    )
  `);
  await dataSource.query(`
    create unique index if not exists amb_green_coverage_osm_id_unique_idx
      on public.amb_green_coverage ("osmId")
      where "osmId" is not null
  `);
  await dataSource.query(`
    create index if not exists amb_green_coverage_geometry_gist_idx
      on public.amb_green_coverage
      using gist (geometry)
  `);
};

const upsertGreenCoverage = async (
  dataSource: DataSource,
  feature: SeedableGreenCoverage,
): Promise<void> => {
  await dataSource.query(
    `
    insert into public.amb_green_coverage (
      "osmId",
      type,
      source,
      name,
      tags,
      geometry,
      "createdAt",
      "updatedAt"
    )
    values (
      $1,
      $2::green_coverage_type_enum,
      $3::green_coverage_source_enum,
      $4,
      $5::jsonb,
      ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)::geography,
      now(),
      now()
    )
    on conflict ("osmId") where "osmId" is not null
    do update set
      type = excluded.type,
      source = excluded.source,
      name = excluded.name,
      tags = excluded.tags,
      geometry = excluded.geometry,
      "updatedAt" = now()
    `,
    [
      feature.osmId,
      feature.type,
      feature.source,
      feature.name,
      JSON.stringify(feature.tags),
      JSON.stringify(feature.geometry),
    ],
  );
};

export const resolveGreenCoverageInputPath = (explicitPath?: string): string =>
  resolve(
    explicitPath ??
      process.env.AMB_GREEN_COVERAGE_OVERPASS_JSON ??
      DEFAULT_OVERPASS_JSON_PATH,
  );

export const seedGreenCoverageFromOverpassJson = async (
  dataSource: DataSource,
  inputPath = resolveGreenCoverageInputPath(),
): Promise<GreenCoverageSeedSummary> => {
  if (!existsSync(inputPath)) {
    throw new Error(`Overpass JSON file not found: ${inputPath}`);
  }

  const data = JSON.parse(readFileSync(inputPath, 'utf8')) as OverpassResponse;
  const { features, skipped } = toSeedableGreenCoverage(data);
  const byType = {
    [GreenCoverageType.TREE]: 0,
    [GreenCoverageType.PARK]: 0,
    [GreenCoverageType.GRASS]: 0,
  };

  await ensureGreenCoverageSchema(dataSource);

  for (const feature of features) {
    await upsertGreenCoverage(dataSource, feature);
    byType[feature.type] += 1;
  }

  return {
    inputPath,
    insertedOrUpdated: features.length,
    skipped,
    byType,
  };
};
