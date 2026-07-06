import { DataSource, Repository } from 'typeorm';
import type { Point, Polygon } from 'geojson';
import { Place, PlaceMetadata, PlaceLocalizedText } from '@/features/places/entities/place.entity';
import { PlaceCategory } from '@/features/places/entities/place-category.enum';
import { TouristSite } from '@/features/places/entities/tourist-site.entity';

const BARRANQUILLA_BBOX = '10.8890,-74.8900,11.0900,-74.7300';
const OVERPASS_URL = process.env.OSM_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const OVERPASS_FALLBACK_URLS = [
  OVERPASS_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
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

interface SeedablePlace {
  osmId: string;
  name: PlaceLocalizedText;
  description?: PlaceLocalizedText | null;
  category: PlaceCategory;
  location: Point;
  metadata?: PlaceMetadata | null;
}

const ensurePlacesSchema = async (dataSource: DataSource): Promise<void> => {
  await dataSource.query('create extension if not exists postgis');
  await dataSource.query('create extension if not exists pgcrypto');
  await dataSource.query(`
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'place_category_enum') then
        create type place_category_enum as enum ('servicios', 'transporte', 'comida', 'compras', 'salud');
      end if;
    end $$
  `);
  await dataSource.query('alter table if exists public.places add column if not exists "osmId" varchar');
  await dataSource.query(`
    create unique index if not exists places_osm_id_unique_idx
      on public.places ("osmId")
      where "osmId" is not null
  `);
  await dataSource.query(`
    create table if not exists public.tourist_sites (
      id uuid primary key default gen_random_uuid(),
      "osmId" varchar,
      name jsonb not null,
      description jsonb,
      category place_category_enum not null default 'servicios',
      location geography(Point, 4326) not null,
      metadata jsonb,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    )
  `);
  await dataSource.query('alter table if exists public.tourist_sites add column if not exists "osmId" varchar');
  await dataSource.query('alter table if exists public.tourist_sites add column if not exists description jsonb');
  await dataSource.query(`
    alter table if exists public.tourist_sites
      add column if not exists category place_category_enum not null default 'servicios'
  `);
  await dataSource.query(`
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
    end $$
  `);
  await dataSource.query('alter table if exists public.tourist_sites add column if not exists metadata jsonb');
  await dataSource.query(`
    alter table if exists public.tourist_sites
      add column if not exists "createdAt" timestamptz not null default now()
  `);
  await dataSource.query(`
    alter table if exists public.tourist_sites
      add column if not exists "updatedAt" timestamptz not null default now()
  `);
  await dataSource.query(`
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
    end $$
  `);
  await dataSource.query(`
    create unique index if not exists tourist_sites_osm_id_unique_idx
      on public.tourist_sites ("osmId")
      where "osmId" is not null
  `);
  await dataSource.query(`
    create index if not exists tourist_sites_location_gist_idx
      on public.tourist_sites
      using gist (location)
  `);
  await dataSource.query(`
    create index if not exists places_location_gist_idx
      on public.places
      using gist (location)
  `);
  await dataSource.query('alter table public.places enable row level security');
  await dataSource.query('alter table public.tourist_sites enable row level security');
  await dataSource.query('drop policy if exists "places_public_read" on public.places');
  await dataSource.query('create policy "places_public_read" on public.places for select using (true)');
  await dataSource.query('drop policy if exists "tourist_sites_public_read" on public.tourist_sites');
  await dataSource.query('create policy "tourist_sites_public_read" on public.tourist_sites for select using (true)');
};

const namedBarranquillaPlacesQuery = `
[out:json][timeout:90];
(
  node["amenity"~"^(bank|atm|police|fire_station|courthouse|toilets|post_office|bus_station|restaurant|cafe|fast_food|bar|hospital|clinic|pharmacy|doctors|dentist)$"](${BARRANQUILLA_BBOX});
  way["amenity"~"^(bank|atm|police|fire_station|courthouse|toilets|post_office|bus_station|restaurant|cafe|fast_food|bar|hospital|clinic|pharmacy|doctors|dentist)$"](${BARRANQUILLA_BBOX});
  node["public_transport"~"^(platform|station)$"](${BARRANQUILLA_BBOX});
  way["public_transport"~"^(platform|station)$"](${BARRANQUILLA_BBOX});
  node["highway"="bus_stop"](${BARRANQUILLA_BBOX});
  way["highway"="bus_stop"](${BARRANQUILLA_BBOX});
  node["railway"="station"](${BARRANQUILLA_BBOX});
  way["railway"="station"](${BARRANQUILLA_BBOX});
  node["shop"](${BARRANQUILLA_BBOX});
  way["shop"](${BARRANQUILLA_BBOX});
  node["healthcare"](${BARRANQUILLA_BBOX});
  way["healthcare"](${BARRANQUILLA_BBOX});
  node["tourism"~"^(attraction|museum|viewpoint|artwork)$"](${BARRANQUILLA_BBOX});
  way["tourism"~"^(attraction|museum|viewpoint|artwork)$"](${BARRANQUILLA_BBOX});
  relation["tourism"~"^(attraction|museum|viewpoint|artwork)$"](${BARRANQUILLA_BBOX});
  node["historic"~"^(monument|memorial|castle|archaeological_site)$"](${BARRANQUILLA_BBOX});
  way["historic"~"^(monument|memorial|castle|archaeological_site)$"](${BARRANQUILLA_BBOX});
  relation["historic"~"^(monument|memorial|castle|archaeological_site)$"](${BARRANQUILLA_BBOX});
);
out body center;
`;

const foodAmenities = new Set(['restaurant', 'cafe', 'fast_food', 'bar']);
const healthAmenities = new Set(['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist']);
const transportAmenities = new Set(['bus_station']);

const normalizeName = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const getName = (tags: Record<string, string>): PlaceLocalizedText | null => {
  const es = tags['name:es'] ?? tags.name;

  if (!es) {
    return null;
  }

  return {
    es,
    en: tags['name:en'],
  };
};

const getDescription = (tags: Record<string, string>): PlaceLocalizedText | null => {
  const es = tags['description:es'] ?? tags.description;
  const en = tags['description:en'];

  if (!es && !en) {
    return null;
  }

  return {
    es: es ?? en ?? '',
    en,
  };
};

const getCategory = (tags: Record<string, string>): PlaceCategory => {
  if (tags.shop) {
    return PlaceCategory.COMPRAS;
  }

  if (tags.healthcare || healthAmenities.has(tags.amenity)) {
    return PlaceCategory.SALUD;
  }

  if (
    transportAmenities.has(tags.amenity) ||
    tags.public_transport ||
    tags.highway === 'bus_stop' ||
    tags.railway === 'station'
  ) {
    return PlaceCategory.TRANSPORTE;
  }

  if (foodAmenities.has(tags.amenity)) {
    return PlaceCategory.COMIDA;
  }

  return PlaceCategory.SERVICIOS;
};

const isTouristSite = (tags: Record<string, string>): boolean =>
  Boolean(tags.tourism || tags.historic);

const getLocation = (element: OverpassElement): Point | null => {
  const lat = element.lat ?? element.center?.lat ?? element.geometry?.[0]?.lat;
  const lon = element.lon ?? element.center?.lon ?? element.geometry?.[0]?.lon;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [lon, lat],
  };
};

const getPolygon = (element: OverpassElement): Polygon | undefined => {
  if (!element.geometry || element.geometry.length < 4) {
    return undefined;
  }

  const coordinates = element.geometry.map((point) => [point.lon, point.lat] as [number, number]);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push(first);
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
};

const approximateFootprint = (location: Point, radiusMeters = 22): Polygon => {
  const [longitude, latitude] = location.coordinates;
  const latitudeOffset = radiusMeters / 111_320;
  const longitudeOffset = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));

  return {
    type: 'Polygon',
    coordinates: [[
      [longitude - longitudeOffset, latitude + latitudeOffset],
      [longitude + longitudeOffset, latitude + latitudeOffset],
      [longitude + longitudeOffset, latitude - latitudeOffset],
      [longitude - longitudeOffset, latitude - latitudeOffset],
      [longitude - longitudeOffset, latitude + latitudeOffset],
    ]],
  };
};

const getBuildingHeight = (tags: Record<string, string>): number | undefined => {
  const explicitHeight = Number.parseFloat(tags.height);

  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return explicitHeight;
  }

  const levels = Number.parseFloat(tags['building:levels']);

  if (Number.isFinite(levels) && levels > 0) {
    return Math.round(levels * 3);
  }

  const name = normalizeName(tags.name ?? '');
  return name.includes('ventana al mundo') ? 47 : undefined;
};

const getMetadata = (
  element: OverpassElement,
  tags: Record<string, string>,
  location: Point,
): PlaceMetadata | null => {
  const metadata: PlaceMetadata = {};
  const description = getDescription(tags);
  const openingHours = tags.opening_hours;
  const image = tags.image ?? tags.wikimedia_commons;
  const websiteUrl = tags.website ?? tags.url;
  const polygon = getPolygon(element);
  const buildingHeightMeters = getBuildingHeight(tags);

  if (description) {
    metadata.history = description;
  }

  if (openingHours) {
    metadata.openingHours = {
      es: openingHours,
      en: openingHours,
    };
  }

  if (image?.startsWith('http')) {
    metadata.photos = [image];
  }

  if (websiteUrl) {
    metadata.websiteUrl = websiteUrl;
  }

  if (tags['addr:full'] ?? tags['addr:street']) {
    metadata.address = tags['addr:full'] ?? tags['addr:street'];
  }

  if (buildingHeightMeters) {
    metadata.buildingHeightMeters = buildingHeightMeters;
    metadata.polygon = polygon ?? approximateFootprint(location);
  } else if (polygon) {
    metadata.polygon = polygon;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
};

const toSeedablePlace = (element: OverpassElement): SeedablePlace | null => {
  const tags = element.tags ?? {};
  const name = getName(tags);
  const location = getLocation(element);

  if (!name || !location) {
    return null;
  }

  const description = getDescription(tags);

  return {
    osmId: `${element.type}/${element.id}`,
    name,
    description,
    category: getCategory(tags),
    location,
    metadata: getMetadata(element, tags, location),
  };
};

const upsertByOsmId = async <Entity extends { osmId?: string | null }>(
  repository: Repository<Entity>,
  payload: SeedablePlace,
): Promise<void> => {
  const existing = await repository.findOne({
    where: {
      osmId: payload.osmId,
    } as any,
  });

  await repository.save(repository.create({
    ...(existing ?? {}),
    ...payload,
  } as any));
};

const fetchOverpassPlaces = async (): Promise<OverpassResponse> => {
  const uniqueUrls = Array.from(new Set(OVERPASS_FALLBACK_URLS));
  let lastError = '';

  for (const url of uniqueUrls) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'QuillaMap/1.0 zero-cost-osm-seed',
      },
      body: new URLSearchParams({
        data: namedBarranquillaPlacesQuery,
      }),
    });

    if (response.ok) {
      return (await response.json()) as OverpassResponse;
    }

    const errorBody = await response.text();
    lastError = `${url} responded ${response.status}: ${errorBody.slice(0, 300)}`;
    console.warn(`OSM Overpass seed source skipped: ${lastError}`);
  }

  throw new Error(`OSM Overpass request failed. Last error: ${lastError}`);
};

export const seedOsmPlaces = async (dataSource: DataSource): Promise<void> => {
  await ensurePlacesSchema(dataSource);

  const data = await fetchOverpassPlaces();
  const placeRepository = dataSource.getRepository(Place);
  const touristSiteRepository = dataSource.getRepository(TouristSite);
  let placesCount = 0;
  let touristSitesCount = 0;

  for (const element of data.elements ?? []) {
    const seedable = toSeedablePlace(element);

    if (!seedable) {
      continue;
    }

    if (isTouristSite(element.tags ?? {})) {
      await upsertByOsmId(touristSiteRepository, {
        ...seedable,
        category: PlaceCategory.SERVICIOS,
      });
      touristSitesCount += 1;
      continue;
    }

    await upsertByOsmId(placeRepository, seedable);
    placesCount += 1;
  }

  console.log(`OSM places seeded: ${placesCount} generic places, ${touristSitesCount} tourist sites.`);
};
