import { DataSource } from 'typeorm';
import type { LineString, Point } from 'geojson';
import { inflateRawSync } from 'node:zlib';

const AMB_BBOX = '10.7500,-75.0500,11.1300,-74.6500';
const OVERPASS_URL = process.env.OSM_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const OSM_API_URL = process.env.OSM_API_URL ?? 'https://www.openstreetmap.org/api/0.6';
const OSM_RELATION_SHAPE_LIMIT = Number(process.env.OSM_RELATION_SHAPE_LIMIT ?? 60);
const AMB_SOBUSA_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/SOBUSA';
const AMB_COOLITORAL_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/COOLITORAL';
const AMB_COOTRANTICO_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/COOTRANTICO';
const AMB_LOLAYA_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/LOLAYA';
const AMB_COOTRASOL_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/COOTRASOL';
const AMB_EMBUSA_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/EMBUSA';
const AMB_COOTRAB_KMZ_BASE_URL = 'https://www.test2.ambq.gov.co/rutas-de-buses/COOTRAB';
const AMB_COOTRANSCO_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/COOTRANSCO';
const AMB_COOTRANSNORTE_KMZ_BASE_URL = 'https://www.ambq.gov.co/ruta-de-buses/COOTRANSNORTE';
const AMB_TRANSOLEDAD_KMZ_BASE_URL = 'https://www.test2.ambq.gov.co/rutas-de-buses/TRANSOLEDAD';
const AMB_COOTRANSPORCAR_KMZ_BASE_URL = 'https://www.test2.ambq.gov.co/rutas-de-buses/COOTRANSPORCAR';
const AMB_FLOTA_ANGULO_KMZ_BASE_URL = 'https://www.test2.ambq.gov.co/rutas-de-buses/FLOTA-ANGULO';
const AMB_COOCHOFAL_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/COOCHOFAL';
const AMB_FLOTA_ROJA_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/FLOTA-ROJA';
const AMB_TRASALIANCO_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/TRASALIANCO';
const AMB_TRASALFA_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/TRASALFA';
const AMB_TRANSMECAR_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/TRANSMECAR';
const AMB_TRANSURBAR_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/TRANSURBAR';
const AMB_MONTERREY_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/MONTERREY';
const AMB_LA_CAROLINA_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/LA-CAROLINA';
const AMB_SODETRANS_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/SODETRANS';
const AMB_TRANSDIAZ_KMZ_BASE_URL = 'https://www.ambq.gov.co/rutas-de-buses/TRANSDIAZ';
const AMB_COOASOATLAN_KMZ_BASE_URL = 'https://www.test2.ambq.gov.co/rutas-de-buses/COOASOATLAN';
const OVERPASS_FALLBACK_URLS = [
  OVERPASS_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

type TransitAgencyKind = 'transmetro' | 'colectivo';
type TransitSourceKind = 'official_web' | 'secondary_reference' | 'osm_overpass' | 'manual_override';

interface TransitRouteSeed {
  id: string;
  agencyKind: TransitAgencyKind;
  shortName: string;
  longName?: string;
  operatorName?: string;
  sourceKind: TransitSourceKind;
  sourceSnapshotId: string;
  metadata?: Record<string, unknown>;
}

interface TransitStopSeed {
  id: string;
  routeId: string;
  name: string;
  agencyKind: TransitAgencyKind;
  sourceSnapshotId: string;
  isAccessible: boolean;
  location: Point;
}

interface TransitShapeSeed {
  id: string;
  routeId: string;
  sourceKind: TransitSourceKind;
  sourceSnapshotId: string;
  geometry: LineString;
  metadata?: Record<string, unknown>;
}

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
  members?: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role?: string;
  }>;
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const TRANSIT_SOURCE_SNAPSHOT_ID = 'transit-bootstrap-2026-07-22';
const OSM_COMMUNITY_ROUTE_ID = 'osm-community';

const normalizeId = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const transmetroTrunkRoutes: TransitRouteSeed[] = [
  ['B1', 'Portal de Barranquillita', 'troncal'],
  ['B2', 'Portal de Barranquillita', 'troncal'],
  ['R1', 'Joe Arroyo', 'troncal'],
  ['R2', 'Joe Arroyo', 'troncal'],
  ['S1', 'Portal de Soledad', 'troncal'],
  ['S2', 'Portal de Soledad', 'troncal'],
  ['R10', 'Joe Arroyo', 'expresa'],
  ['S10', 'Portal de Soledad', 'expresa'],
  ['S20', 'Portal de Soledad', 'expresa'],
  ['R40', 'Joe Arroyo', 'expresa'],
  ['S40', 'Portal de Soledad', 'expresa'],
].map(([shortName, longName, serviceKind]) => ({
  id: `transmetro-${normalizeId(shortName)}`,
  agencyKind: 'transmetro',
  shortName,
  longName,
  operatorName: 'Transmetro',
  sourceKind: serviceKind === 'troncal' ? 'official_web' : 'secondary_reference',
  sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  metadata: {
    serviceKind,
  },
} as TransitRouteSeed));

const getTransmetroOperatingMetadata = (shortName: string): Record<string, unknown> | undefined => {
  if (shortName === 'RUTA-NAVIDENA') {
    return {
      operatingCondition: 'christmas_season',
      operatingConditionLabel: 'Solo opera en temporada navidena.',
      seasonalWindow: {
        startsOn: '11-15',
        endsOn: '01-15',
      },
    };
  }

  if (shortName === 'RUTA-CHEVERE') {
    return {
      operatingCondition: 'weekends',
      operatingConditionLabel: 'Solo opera los fines de semana.',
    };
  }

  if (shortName === 'A4-1') {
    return {
      operatingCondition: 'temporarily_suspended',
      operatingConditionLabel: 'Temporalmente parada.',
      isCurrentlyOperatingOverride: false,
      operatorOverrideSource: 'user_current_instruction_2026-07-28',
    };
  }

  return undefined;
};

const transmetroRoutes: TransitRouteSeed[] = [
  ['A1-2', 'Carrera Ocho'],
  ['A1-3', 'Galan'],
  ['A1-4', 'La Magdalena'],
  ['A2-1', 'Hipodromo'],
  ['A3-1', 'Villa Katanga'],
  ['A3-2', 'Soledad 2000'],
  ['A3-3', 'Manuela Beltran'],
  ['A3-4', 'Villa Sol'],
  ['A3-41', 'Villa Karla'],
  ['A5-1', 'Los Robles / Los Almendros'],
  ['A5-2', 'Las Moras'],
  ['A5-3', 'La Central'],
  ['A5-4', 'San Antonio'],
  ['A5-5', 'Manantial'],
  ['A6-5', 'Carrizal'],
  ['A6-6', 'Ciudadela'],
  ['A7-1', 'Miramar'],
  ['A7-3', 'Carrera 38'],
  ['A7-4', 'Los Andes'],
  ['A8-1', 'Paraiso'],
  ['A8-2', 'Via 40'],
  ['A8-3', 'Prado'],
  ['A9-3', 'Buenavista'],
  ['A9-4', 'Carrera 46 / fines de semana'],
  ['U-30', 'Universidades'],
  ['GRAN-MALECON', 'Gran Malecon'],
  ['RUTA-NAVIDENA', 'Ruta Navidena'],
  ['RUTA-CHEVERE', 'Ruta Chevere'],
  ['A4-1', 'Malambo'],
].map(([shortName, longName]) => ({
  id: `transmetro-${normalizeId(shortName)}`,
  agencyKind: 'transmetro',
  shortName,
  longName,
  operatorName: 'Transmetro',
  sourceKind: 'official_web',
  sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  metadata: getTransmetroOperatingMetadata(shortName),
}));

const collectiveRoutes: TransitRouteSeed[] = [
  ['FLOTA-ANGULO', 'A7-4112'],
  ['TRANSMECAR', 'C17-4160'],
  ['TRANSMECAR', 'D10-4172'],
  ['TRANSMECAR', 'D11-4153'],
  ['TRANSMECAR', 'D9-4152'],
  ['FLOTA-ROJA', 'A8-4113'],
  ['TRANSDIAZ', 'A10-4114 A'],
  ['TRANSDIAZ', 'A10-4114 B'],
  ['TRANSDIAZ', 'A11-4115'],
  ['TRANSDIAZ', 'B16-4130'],
  ['COOTRAB', 'C5-4135'],
  ['COOTRAB', 'C6-4137'],
  ['EMBUSA', 'B9-4125'],
  ['MONTERREY', 'B11-4166'],
  ['MONTERREY', 'B12-4127'],
  ['MONTERREY', 'B8-4124'],
  ['MONTERREY', 'B11-B-4192'],
  ['LA-CAROLINA', 'A16-4161 A'],
  ['LA-CAROLINA', 'A16-4161 B'],
  ['LA-CAROLINA', 'D6-4150'],
  ['LA-CAROLINA', 'D7-4151'],
  ['COOTRANSPORCAR', 'C8-4139'],
  ['COOCHOFAL', 'A15-4159'],
  ['COOCHOFAL', 'C2-4133'],
  ['COOCHOFAL', 'C2-B-4187'],
  ['COOCHOFAL', 'C3-4134'],
  ['COOCHOFAL', 'C4-4135'],
  ['COOCHOFAL', 'C9-4140'],
  ['COOCHOFAL', 'C18-4141'],
  ['COOCHOFAL', 'D20-4185'],
  ['TRASALFA', 'D15-4157'],
  ['TRASALFA', 'D14-4156'],
  ['TRASALFA', 'B2-B-4118'],
  ['COOLITORAL', 'A1-4106 A'],
  ['COOLITORAL', 'A1-4106 B'],
  ['COOLITORAL', 'A2-4107'],
  ['COOLITORAL', 'A3-4108'],
  ['COOLITORAL', 'A4-4109'],
  ['COOLITORAL', 'B1-4117'],
  ['COOLITORAL', 'B2A-4177'],
  ['COOLITORAL', 'B3-4119'],
  ['COOLITORAL', 'B17-4163'],
  ['COOLITORAL', 'C19-4178'],
  ['COOLITORAL', 'PT1'],
  ['COOLITORAL', 'PT2'],
  ['COOLITORAL', 'PT3'],
  ['COOLITORAL', 'PT4'],
  ['COOLITORAL', 'PT5'],
  ['COOTRANTICO', 'A18-4183'],
  ['COOTRANTICO', 'B4-4120'],
  ['COOTRANTICO', 'B5-4121'],
  ['COOTRANTICO', 'B5-B-4190'],
  ['COOTRANTICO', 'B6-4122'],
  ['COOTRANTICO', 'B7-4123'],
  ['COOTRANTICO', 'B20-4180'],
  ['COOTRANTICO', 'B20-B-4191'],
  ['LOLAYA', 'B10-4126'],
  ['LOLAYA', 'B10-B-4193'],
  ['LOLAYA', 'D8-4165'],
  ['COOTRANSCO', 'C7-4138'],
  ['COOTRASOL', 'D3-4147'],
  ['COOTRASOL', 'D4-4148'],
  ['COOTRASOL', 'D5-4149'],
  ['SOBUSA', 'B18-4175 A'],
  ['SOBUSA', 'B18-4175 B'],
  ['SOBUSA', 'C11-4168'],
  ['SOBUSA', 'C12-4169 A'],
  ['SOBUSA', 'C12-4169 B'],
  ['SOBUSA', 'C13-4143'],
  ['SOBUSA', 'C14-4170'],
  ['SOBUSA', 'C16-4167 A'],
  ['SOBUSA', 'C16-4167 B'],
  ['TRANSOLEDAD', 'D13-4155'],
  ['TRANSURBAR', 'A14-4116'],
  ['TRANSURBAR', 'D19-4184'],
  ['TRANSURBAR', 'D16-4173'],
  ['SODETRANS', 'B13-4128'],
  ['SODETRANS', 'B13-B-4189'],
  ['SODETRANS', 'B14-4174'],
  ['SODETRANS', 'B15-4129 A'],
  ['SODETRANS', 'B15-4129 B'],
  ['SODETRANS', 'C21-4182 A'],
  ['SODETRANS', 'C21-4182 B'],
  ['COOTRANSNORTE', 'A6-4111'],
  ['COOTRANSNORTE', 'A5-4110'],
  ['TRASALIANCO', 'B19-4176'],
  ['TRASALIANCO', 'D18-4179'],
  ['TRASALIANCO', 'D12-4154'],
  ['TRASALIANCO', 'D17-4158'],
  ['COOASOATLAN', 'C1-4132'],
  ['COOASOATLAN', 'C1-B-4186'],
  ['COOASOATLAN', 'C20-4181'],
  ['COOASOATLAN', 'C20-B-4187'],
].map(([operatorName, shortName]) => ({
  id: `amb-${normalizeId(operatorName)}-${normalizeId(shortName)}`,
  agencyKind: 'colectivo',
  shortName,
  longName: `${operatorName} ${shortName}`,
  operatorName,
  sourceKind: 'official_web',
  sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  metadata: ['SODETRANS', 'TRANSDIAZ'].includes(operatorName)
    ? { operatorGroupName: 'ALIANZA SODIS' }
    : undefined,
}));

const manualBootstrapRoutes: TransitRouteSeed[] = [
  {
    id: OSM_COMMUNITY_ROUTE_ID,
    agencyKind: 'colectivo',
    shortName: 'OSM',
    longName: 'Paraderos comunitarios OSM sin ruta asociada',
    sourceKind: 'osm_overpass',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  },
];

const metropolitanReferenceRoutes: TransitRouteSeed[] = [
  ['TRANSPORTES-COSTA-AZUL', 'PUERTO-COLOMBIA-AUTOPISTA', 'Puerto Colombia Autopista', 'Puerto Colombia'],
  ['TRANSPORTES-COSTA-AZUL', 'SALGAR-VIA-ANTIGUA', 'Salgar via antigua', 'Puerto Colombia / Salgar'],
  ['EXPRESO-COLOMBIA-CARIBE', 'SALGAR', 'Salgar', 'Puerto Colombia / Salgar'],
  ['COOTRANTICO', 'GALAPA', 'Galapa - Barranquilla', 'Galapa'],
  ['LUCERO-SAN-FELIPE', 'GALAPA', 'Galapa', 'Galapa'],
  ['LUCERO-SAN-FELIPE', 'GALAPA-CALLE-72', 'Galapa Calle 72', 'Galapa / Barranquilla'],
  ['TRASALFA', 'MALAMBO-CORREDOR-UNIVERSITARIO', 'Malambo - Corredor Universitario', 'Malambo'],
  ['TRASALFA', 'PIMSA-CALLE-30', 'PIMSA Calle 30', 'Malambo'],
  ['TRASALFA', 'PIMSA-PLACA-NEGRA', 'PIMSA Placa Negra', 'Malambo'],
  ['TRASALIANCO', 'MALAMBO-EL-CARMEN-BELLAVISTA', 'Malambo El Carmen Bellavista', 'Malambo'],
  ['COOLITORAL', 'CENTRO-PUEBLO-CORREDOR-UNIVERSITARIO', 'Centro Pueblo - Corredor Universitario', 'Caribe Verde / Ciudad Caribe / Villas de San Pablo'],
  ['COOLITORAL', 'CENTRO-PUEBLO-RUTA-MAKRO', 'Centro Pueblo - Ruta Makro', 'Caribe Verde / Ciudad Caribe / Villas de San Pablo'],
  ['SODIS-COOLITORAL', 'JUAN-MINA-VILLA-SAN-PABLO-RUTA-MAKRO', 'Juan Mina - Villa San Pablo - Ruta Makro', 'Juan Mina / Villa San Pablo'],
  ['FLOTA-ANGULO', 'ALAMEDA-RUTA-MAKRO', 'Alameda del Rio - Ruta Makro', 'Alameda del Rio'],
  ['FLOTA-ANGULO', 'ALAMEDA-SODIS-FRANJA-ROSADA', 'Alameda del Rio - Sodis Franja Rosada', 'Alameda del Rio'],
].map(([operatorName, shortName, longName, corridor]) => ({
  id: `amb-metro-${normalizeId(operatorName)}-${normalizeId(shortName)}`,
  agencyKind: 'colectivo',
  shortName,
  longName: `${operatorName} ${longName}`,
  operatorName,
  sourceKind: 'secondary_reference',
  sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  metadata: {
    seededBy: 'quillamap-transit-seed',
    corridor,
    serviceScope: 'metropolitano',
  },
} as TransitRouteSeed));

const sobusaReferenceRoutes: TransitRouteSeed[] = [
  ['B18', 'Tcherassi', 'Puerto Colombia / Soledad'],
  ['C11', 'Carrera 14 - Silencio', 'Barranquilla / Soledad'],
  ['C12', 'Vivero Paraiso', 'Barranquilla / Soledad'],
  ['C13', 'Carrera 50 - Paraiso', 'Barranquilla / Soledad'],
  ['C14', 'Carrera 54 - Uninorte', 'La Playa / Corredor Universitario / Soledad'],
  ['C16', 'Calle 72 - Uninorte', 'Barranquilla / Corredor Universitario / Soledad'],
].map(([shortName, longName, corridor]) => ({
  id: `amb-sobusa-${normalizeId(shortName)}`,
  agencyKind: 'colectivo',
  shortName,
  longName: `SOBUSA ${longName}`,
  operatorName: 'SOBUSA',
  sourceKind: 'secondary_reference',
  sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  metadata: {
    seededBy: 'quillamap-transit-seed',
    corridor,
    serviceScope: 'metropolitano',
  },
} as TransitRouteSeed));

const transitOverpassQuery = `
[out:json][timeout:180];
relation["type"="route"]["route"="bus"](${AMB_BBOX})->.routes;
(
  .routes;
  node["highway"="bus_stop"](${AMB_BBOX});
  node["public_transport"~"^(platform|stop_position|station)$"](${AMB_BBOX});
);
out body center;
way(r.routes);
out body geom;
`;

const ensureTransitSchema = async (dataSource: DataSource): Promise<void> => {
  await dataSource.query('create extension if not exists postgis');
  await dataSource.query(`
    create table if not exists public.transit_routes (
      id varchar primary key,
      agency_kind varchar not null,
      short_name varchar not null,
      long_name varchar,
      operator_name varchar,
      source_kind varchar not null,
      source_snapshot_id varchar not null,
      metadata jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await dataSource.query(`
    create table if not exists public.transit_stops (
      id varchar primary key,
      route_id varchar not null,
      name varchar not null,
      agency_kind varchar not null default 'colectivo',
      source_snapshot_id varchar not null default 'manual-bootstrap',
      is_accessible boolean not null default false,
      geom geometry(Point, 4326) not null
    )
  `);
  await dataSource.query('alter table public.transit_stops add column if not exists route_id varchar');
  await dataSource.query('alter table public.transit_stops add column if not exists agency_kind varchar not null default \'colectivo\'');
  await dataSource.query('alter table public.transit_stops add column if not exists source_snapshot_id varchar not null default \'manual-bootstrap\'');
  await dataSource.query('alter table public.transit_stops add column if not exists is_accessible boolean not null default false');
  await dataSource.query(`
    create table if not exists public.transit_shapes (
      id varchar primary key,
      route_id varchar not null references public.transit_routes(id) on delete cascade,
      source_kind varchar not null,
      source_snapshot_id varchar not null,
      geom geometry(LineString, 4326) not null,
      metadata jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await dataSource.query('create index if not exists transit_routes_source_kind_idx on public.transit_routes (source_kind)');
  await dataSource.query('create index if not exists transit_routes_agency_kind_idx on public.transit_routes (agency_kind)');
  await dataSource.query('create index if not exists transit_stops_route_id_idx on public.transit_stops (route_id)');
  await dataSource.query('create index if not exists transit_stops_geom_gix on public.transit_stops using gist (geom)');
  await dataSource.query('create index if not exists transit_shapes_route_id_idx on public.transit_shapes (route_id)');
  await dataSource.query('create index if not exists transit_shapes_geom_gix on public.transit_shapes using gist (geom)');
};

const upsertRoute = async (dataSource: DataSource, route: TransitRouteSeed): Promise<void> => {
  await dataSource.query(
    `
    insert into public.transit_routes (
      id,
      agency_kind,
      short_name,
      long_name,
      operator_name,
      source_kind,
      source_snapshot_id,
      metadata,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, now())
    on conflict (id) do update set
      agency_kind = excluded.agency_kind,
      short_name = excluded.short_name,
      long_name = excluded.long_name,
      operator_name = excluded.operator_name,
      source_kind = excluded.source_kind,
      source_snapshot_id = excluded.source_snapshot_id,
      metadata = excluded.metadata,
      updated_at = now()
    `,
    [
      route.id,
      route.agencyKind,
      route.shortName,
      route.longName ?? null,
      route.operatorName ?? null,
      route.sourceKind,
      route.sourceSnapshotId,
      JSON.stringify({
        ...(route.metadata ?? {}),
        seededBy: 'quillamap-transit-seed',
        geometryStatus: route.sourceKind === 'official_web' ? 'catalog_only' : 'community',
      }),
    ],
  );
};

const upsertStop = async (dataSource: DataSource, stop: TransitStopSeed): Promise<void> => {
  await dataSource.query(
    `
    insert into public.transit_stops (
      id,
      route_id,
      name,
      agency_kind,
      source_snapshot_id,
      is_accessible,
      geom
    )
    values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      ST_SetSRID(ST_MakePoint($7, $8), 4326)
    )
    on conflict (id) do update set
      route_id = excluded.route_id,
      name = excluded.name,
      agency_kind = excluded.agency_kind,
      source_snapshot_id = excluded.source_snapshot_id,
      is_accessible = excluded.is_accessible,
      geom = excluded.geom
    `,
    [
      stop.id,
      stop.routeId,
      stop.name,
      stop.agencyKind,
      stop.sourceSnapshotId,
      stop.isAccessible,
      stop.location.coordinates[0],
      stop.location.coordinates[1],
    ],
  );
};

const upsertShape = async (dataSource: DataSource, shape: TransitShapeSeed): Promise<void> => {
  await dataSource.query(
    `
    insert into public.transit_shapes (
      id,
      route_id,
      source_kind,
      source_snapshot_id,
      geom,
      metadata
    )
    values (
      $1,
      $2,
      $3,
      $4,
      ST_SetSRID(ST_GeomFromGeoJSON($5), 4326),
      $6
    )
    on conflict (id) do update set
      route_id = excluded.route_id,
      source_kind = excluded.source_kind,
      source_snapshot_id = excluded.source_snapshot_id,
      geom = excluded.geom,
      metadata = excluded.metadata
    `,
    [
      shape.id,
      shape.routeId,
      shape.sourceKind,
      shape.sourceSnapshotId,
      JSON.stringify(shape.geometry),
      JSON.stringify({
        ...(shape.metadata ?? {}),
        seededBy: 'quillamap-transit-seed',
      }),
    ],
  );
};

const upsertShapeAliasFromExistingRoute = async (
  dataSource: DataSource,
  alias: ExistingShapeAliasSeed,
): Promise<boolean> => {
  const result = await dataSource.query(
    `
    insert into public.transit_shapes (
      id,
      route_id,
      source_kind,
      source_snapshot_id,
      geom,
      metadata
    )
    select
      $1,
      $2,
      $3,
      $4,
      geom,
      $6::jsonb || jsonb_build_object(
        'seededBy', 'quillamap-transit-seed',
        'aliasedFromShapeId', id,
        'aliasedFromRouteId', route_id,
        'points', ST_NPoints(geom)
      )
    from public.transit_shapes
    where route_id = $5
    order by id asc
    limit 1
    on conflict (id) do update set
      route_id = excluded.route_id,
      source_kind = excluded.source_kind,
      source_snapshot_id = excluded.source_snapshot_id,
      geom = excluded.geom,
      metadata = excluded.metadata
    returning id
    `,
    [
      alias.id,
      alias.routeId,
      alias.sourceKind,
      alias.sourceSnapshotId,
      alias.sourceRouteId,
      JSON.stringify(alias.metadata),
    ],
  ) as Array<{ id: string }>;

  return result.length > 0;
};

const fetchOverpassTransit = async (): Promise<OverpassResponse | null> => {
  const uniqueUrls = Array.from(new Set(OVERPASS_FALLBACK_URLS));
  let lastError = '';

  for (const url of uniqueUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'QuillaMap/1.0 zero-cost-transit-seed',
        },
        body: new URLSearchParams({
          data: transitOverpassQuery,
        }),
      });

      if (response.ok) {
        return (await response.json()) as OverpassResponse;
      }

      const body = await response.text();
      lastError = `${url} responded ${response.status}: ${body.slice(0, 240)}`;
    } catch (error) {
      lastError = `${url} failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    console.warn(`Transit Overpass source skipped: ${lastError}`);
  }

  console.warn(`Transit Overpass seed skipped. Last error: ${lastError}`);
  return null;
};

const toOsmRoute = (element: OverpassElement): TransitRouteSeed | null => {
  const tags = element.tags ?? {};
  const shortName = tags.ref ?? tags.name;

  if (!shortName) {
    return null;
  }

  const operatorName = tags.operator;
  const isTransmetro = `${operatorName ?? ''} ${tags.network ?? ''} ${tags.name ?? ''}`
    .toLowerCase()
    .includes('transmetro');

  return {
    id: `osm-relation-${element.id}`,
    agencyKind: isTransmetro ? 'transmetro' : 'colectivo',
    shortName,
    longName: tags.name,
    operatorName,
    sourceKind: 'osm_overpass',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
  };
};

const getStopName = (element: OverpassElement): string => {
  const tags = element.tags ?? {};
  return tags.name ?? tags.ref ?? `Paradero OSM ${element.id}`;
};

const toOsmStop = (element: OverpassElement): TransitStopSeed | null => {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  return {
    id: `osm-stop-${element.type}-${element.id}`,
    routeId: OSM_COMMUNITY_ROUTE_ID,
    name: getStopName(element),
    agencyKind: 'colectivo',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
    isAccessible: false,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  };
};

type CoordinateTuple = [number, number];

interface WayShapeInfo {
  coordinates: CoordinateTuple[];
  streetName?: string;
}

interface ExistingOsmRelationRow {
  relation_id: string;
}

interface OfficialKmzRouteShapeSeed {
  fileName: string;
  routeShortNames: string[];
}

interface ExistingShapeAliasSeed {
  id: string;
  routeId: string;
  sourceRouteId: string;
  sourceKind: TransitSourceKind;
  sourceSnapshotId: string;
  metadata: Record<string, unknown>;
}

const sobusaOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B18-4175.kmz', routeShortNames: ['B18-4175 A', 'B18-4175 B'] },
  { fileName: 'C11-4168.kmz', routeShortNames: ['C11-4168'] },
  { fileName: 'C12-4169.kmz', routeShortNames: ['C12-4169 A', 'C12-4169 B'] },
  { fileName: 'C13-4143.kmz', routeShortNames: ['C13-4143'] },
  { fileName: 'C14-4170.kmz', routeShortNames: ['C14-4170'] },
  { fileName: 'C16-4167.kmz', routeShortNames: ['C16-4167 A', 'C16-4167 B'] },
];

const coolitoralOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A1-4106 A.kmz', routeShortNames: ['A1-4106 A'] },
  { fileName: 'A1-4106 B.kmz', routeShortNames: ['A1-4106 B'] },
  { fileName: 'A2-4107.kmz', routeShortNames: ['A2-4107'] },
  { fileName: 'A3-4108.kmz', routeShortNames: ['A3-4108'] },
  { fileName: 'A4-4109.kmz', routeShortNames: ['A4-4109'] },
  { fileName: 'B1-4117.kmz', routeShortNames: ['B1-4117'] },
  { fileName: 'B17-4163.kmz', routeShortNames: ['B17-4163'] },
  { fileName: 'B2A-4177.kmz', routeShortNames: ['B2A-4177'] },
  { fileName: 'B3-4119.kmz', routeShortNames: ['B3-4119'] },
  { fileName: 'C19-4178.kmz', routeShortNames: ['C19-4178'] },
  { fileName: 'PT1-4101.kmz', routeShortNames: ['PT1'] },
  { fileName: 'PT2-4102.kmz', routeShortNames: ['PT2'] },
  { fileName: 'PT3-4103.kmz', routeShortNames: ['PT3'] },
  { fileName: 'PT4-4104.kmz', routeShortNames: ['PT4'] },
  { fileName: 'PT5-4105.kmz', routeShortNames: ['PT5'] },
];

const cootranticoOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A18-4183.kmz', routeShortNames: ['A18-4183'] },
  { fileName: 'B20-4180.kmz', routeShortNames: ['B20-4180'] },
  { fileName: 'B20-B-4191.kmz', routeShortNames: ['B20-B-4191'] },
  { fileName: 'B4-4120.kmz', routeShortNames: ['B4-4120'] },
  { fileName: 'B5-4121.kmz', routeShortNames: ['B5-4121'] },
  { fileName: 'B5-B-4190.kmz', routeShortNames: ['B5-B-4190'] },
  { fileName: 'B6-4122.kmz', routeShortNames: ['B6-4122'] },
  { fileName: 'B7-4123.kmz', routeShortNames: ['B7-4123'] },
];

const lolayaOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B10-4126.kmz', routeShortNames: ['B10-4126'] },
  { fileName: 'B10-B-4193.kmz', routeShortNames: ['B10-B-4193'] },
  { fileName: 'D8-4165.kmz', routeShortNames: ['D8-4165'] },
];

const cootrasolOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'D3-4147.kmz', routeShortNames: ['D3-4147'] },
  { fileName: 'D4-4148.kmz', routeShortNames: ['D4-4148'] },
  { fileName: 'D5-4149.kmz', routeShortNames: ['D5-4149'] },
];

const embusaOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B9-4125.kmz', routeShortNames: ['B9-4125'] },
];

const cootrabOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'C5-4136.kmz', routeShortNames: ['C5-4135'] },
  { fileName: 'C6-4137.kmz', routeShortNames: ['C6-4137'] },
];

const cootranscoOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'C7-4138.kmz', routeShortNames: ['C7-4138'] },
];

const cootransnorteOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A5-4110.kmz', routeShortNames: ['A5-4110'] },
  { fileName: 'A6-4111.kmz', routeShortNames: ['A6-4111'] },
];

const transoledadOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'D13-4155.kmz', routeShortNames: ['D13-4155'] },
];

const cootransporcarOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'C8-4139.kmz', routeShortNames: ['C8-4139'] },
];

const coochofalOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A15-4159.kmz', routeShortNames: ['A15-4159'] },
  { fileName: 'C18- 4141.kmz', routeShortNames: ['C18-4141'] },
  { fileName: 'C2-4133.kmz', routeShortNames: ['C2-4133', 'C2-B-4187'] },
  { fileName: 'C4-4135.kmz', routeShortNames: ['C4-4135'] },
  { fileName: 'C9-4140.kmz', routeShortNames: ['C9-4140'] },
  { fileName: 'D20-4185.kmz', routeShortNames: ['D20-4185'] },
];

const flotaAnguloOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A7-4112.kmz', routeShortNames: ['A7-4112'] },
];

const flotaRojaOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A8-4113.kmz', routeShortNames: ['A8-4113'] },
];

const trasaliancoOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B19-4176.kmz', routeShortNames: ['B19-4176'] },
  { fileName: 'D12-4154.kmz', routeShortNames: ['D12-4154'] },
  { fileName: 'D17-4158.kmz', routeShortNames: ['D17-4158'] },
  { fileName: 'D18-4179.kmz', routeShortNames: ['D18-4179'] },
];

const trasalfaOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B2B-4118.kmz', routeShortNames: ['B2-B-4118'] },
  { fileName: 'D14-4156.kmz', routeShortNames: ['D14-4156'] },
  { fileName: 'D15-4157.kmz', routeShortNames: ['D15-4157'] },
];

const transmecarOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'C17-4160.kmz', routeShortNames: ['C17-4160'] },
  { fileName: 'D10-4172.kmz', routeShortNames: ['D10-4172'] },
  { fileName: 'D11-4153.kmz', routeShortNames: ['D11-4153'] },
  { fileName: 'D9-4152.kmz', routeShortNames: ['D9-4152'] },
];

const transurbarOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A14-4116.kmz', routeShortNames: ['A14-4116'] },
  { fileName: 'D16-4173.kmz', routeShortNames: ['D16-4173'] },
  { fileName: 'D19-4184.kmz', routeShortNames: ['D19-4184'] },
];

const monterreyOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B11-4166.kmz', routeShortNames: ['B11-4166', 'B11-B-4192'] },
  { fileName: 'B12-4127.kmz', routeShortNames: ['B12-4127'] },
  { fileName: 'B8-4124.kmz', routeShortNames: ['B8-4124'] },
];

const laCarolinaOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A16-4161.kmz', routeShortNames: ['A16-4161 A', 'A16-4161 B'] },
  { fileName: 'D6-4150.kmz', routeShortNames: ['D6-4150'] },
  { fileName: 'D7-4151.kmz', routeShortNames: ['D7-4151'] },
];

const sodetransOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'B13-4128.kmz', routeShortNames: ['B13-4128', 'B13-B-4189'] },
  { fileName: 'B14-4174.kmz', routeShortNames: ['B14-4174'] },
  { fileName: 'B15-4129.kmz', routeShortNames: ['B15-4129 A', 'B15-4129 B'] },
  { fileName: 'C21-4182.kmz', routeShortNames: ['C21-4182 A', 'C21-4182 B'] },
];

const transdiazOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'A10-4114.kmz', routeShortNames: ['A10-4114 A', 'A10-4114 B'] },
  { fileName: 'A11-4115.kmz', routeShortNames: ['A11-4115'] },
  { fileName: 'B16-4130.kmz', routeShortNames: ['B16-4130'] },
];

const cooasoatlanOfficialKmzRoutes: OfficialKmzRouteShapeSeed[] = [
  { fileName: 'C1-4132.kmz', routeShortNames: ['C1-4132', 'C1-B-4186'] },
  { fileName: 'C20-4181.kmz', routeShortNames: ['C20-4181', 'C20-B-4187'] },
];

const transmetroPendingShapeAliases: ExistingShapeAliasSeed[] = [
  {
    id: 'transmetro-secondary-s20',
    routeId: 'transmetro-s20',
    sourceRouteId: 'osm-relation-2382288',
    sourceKind: 'secondary_reference',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
    metadata: {
      sourceAuthority: 'Transmetro operational notices and OpenStreetMap',
      sourceUrl: 'https://noticiascoopercom.co/transmetro-cierra-2-estaciones-suspende-7-rutas-y-desvia-5-por-guacherna/',
      sourceRouteId: 'osm-relation-2382288',
      sourceRouteShortName: 'S2',
      operatorName: 'Transmetro',
      geometryStatus: 'secondary_reference_shape_alias',
      aliasReason: 'S20 is documented as a Portal de Soledad trunk/express service using the Parque Cultural to Portal de Soledad corridor; no separate official downloadable shape was found.',
    },
  },
  {
    id: 'transmetro-secondary-ruta-navidena',
    routeId: 'transmetro-ruta-navidena',
    sourceRouteId: 'osm-relation-17808915',
    sourceKind: 'secondary_reference',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
    metadata: {
      sourceAuthority: 'Transmetro press coverage and OpenStreetMap',
      sourceUrl: 'https://www.eltiempo.com/colombia/barranquilla/barranquilla-rutas-de-transmetro-a-ventana-al-mundo-y-ecoparque-833035',
      sourceRouteId: 'osm-relation-17808915',
      sourceRouteShortName: 'VM',
      operatorName: 'Transmetro',
      geometryStatus: 'secondary_reference_shape_alias',
      aliasReason: 'Ruta Navidena is documented as a seasonal Transmetro route toward Ventana al Mundo; no separate official downloadable shape was found.',
    },
  },
  {
    id: 'transmetro-secondary-ruta-chevere',
    routeId: 'transmetro-ruta-chevere',
    sourceRouteId: 'osm-relation-17808888',
    sourceKind: 'secondary_reference',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
    metadata: {
      sourceAuthority: 'Gran Malecon route page and OpenStreetMap',
      sourceUrl: 'https://granmalecon.com/como-llegar/',
      sourceRouteId: 'osm-relation-17808888',
      sourceRouteShortName: 'M',
      operatorName: 'Transmetro',
      geometryStatus: 'secondary_reference_shape_alias',
      aliasReason: 'Ruta Chevere is documented as a weekend/holiday tourist service connecting Gran Malecon, Puerto Mocho, Cienaga de Mallorquin and Ventana al Mundo; no separate official downloadable shape was found.',
    },
  },
];

const getWayShapeInfoById = (elements: OverpassElement[]): Map<number, WayShapeInfo> => {
  const wayShapeInfoById = new Map<number, WayShapeInfo>();

  for (const element of elements) {
    if (element.type !== 'way' || !element.geometry || element.geometry.length < 2) {
      continue;
    }

    wayShapeInfoById.set(
      element.id,
      {
        coordinates: element.geometry.map((coordinate) => [coordinate.lon, coordinate.lat]),
        streetName: element.tags?.name,
      }
    );
  }

  return wayShapeInfoById;
};

const dedupeConsecutiveCoordinates = (coordinates: CoordinateTuple[]): CoordinateTuple[] =>
  coordinates.filter((coordinate, index) => {
    const previous = coordinates[index - 1];
    return !previous || previous[0] !== coordinate[0] || previous[1] !== coordinate[1];
  });

const getKmzSourceUrl = (fileName: string, baseUrl = AMB_SOBUSA_KMZ_BASE_URL): string =>
  `${baseUrl}/${encodeURIComponent(fileName)}`;

const readUInt16 = (buffer: Buffer, offset: number): number => buffer.readUInt16LE(offset);
const readUInt32 = (buffer: Buffer, offset: number): number => buffer.readUInt32LE(offset);

const extractKmzKmlEntries = (buffer: Buffer): string[] => {
  const entries: string[] = [];
  let offset = 0;

  while (offset + 30 < buffer.length) {
    const signature = readUInt32(buffer, offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const method = readUInt16(buffer, offset + 8);
    const compressedSize = readUInt32(buffer, offset + 18);
    const fileNameLength = readUInt16(buffer, offset + 26);
    const extraLength = readUInt16(buffer, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString('utf8');
    const compressed = buffer.subarray(dataStart, dataEnd);

    if (name.toLowerCase().endsWith('.kml')) {
      if (method === 0) {
        entries.push(compressed.toString('utf8'));
      } else if (method === 8) {
        entries.push(inflateRawSync(compressed).toString('utf8'));
      }
    }

    offset = dataEnd;
  }

  return entries;
};

const parseKmlCoordinates = (kml: string): CoordinateTuple[][] =>
  Array.from(kml.matchAll(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/gi))
    .map((match) =>
      dedupeConsecutiveCoordinates(
        match[1]
          .trim()
          .split(/\s+/)
          .map((tuple) => tuple.split(',').map(Number))
          .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
          .map(([longitude, latitude]) => [longitude, latitude] as CoordinateTuple)
      )
    )
    .filter((coordinates) => coordinates.length >= 3);

const fetchOfficialKmzShape = async (
  routeShape: OfficialKmzRouteShapeSeed,
  baseUrl: string,
  operatorLabel: string,
): Promise<LineString | null> => {
  const sourceUrl = getKmzSourceUrl(routeShape.fileName, baseUrl);
  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'QuillaMap/1.0 official-amb-kmz-transit-seed',
    },
  });

  if (!response.ok) {
    console.warn(`${operatorLabel} KMZ ${routeShape.fileName} skipped: ${response.status}`);
    return null;
  }

  const kmlEntries = extractKmzKmlEntries(Buffer.from(await response.arrayBuffer()));
  const coordinateGroups = kmlEntries.flatMap(parseKmlCoordinates);
  const coordinates = coordinateGroups.sort((left, right) => right.length - left.length)[0];

  if (!coordinates) {
    console.warn(`${operatorLabel} KMZ ${routeShape.fileName} skipped: no valid LineString found.`);
    return null;
  }

  return {
    type: 'LineString',
    coordinates,
  };
};

export const seedSobusaOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const sobusaRoutes = collectiveRoutes.filter((route) => route.operatorName === 'SOBUSA');
  for (const route of sobusaRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of sobusaOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_SOBUSA_KMZ_BASE_URL, 'SOBUSA');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = sobusaRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`SOBUSA route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-sobusa-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'SOBUSA',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`SOBUSA official transit seeded: ${sobusaRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCoolitoralOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const coolitoralRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOLITORAL');
  for (const route of coolitoralRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of coolitoralOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOLITORAL_KMZ_BASE_URL, 'COOLITORAL');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = coolitoralRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOLITORAL route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-coolitoral-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOLITORAL_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOLITORAL',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOLITORAL official transit seeded: ${coolitoralRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCootranticoOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cootranticoRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOTRANTICO');
  for (const route of cootranticoRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cootranticoOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOTRANTICO_KMZ_BASE_URL, 'COOTRANTICO');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cootranticoRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOTRANTICO route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cootrantico-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOTRANTICO_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOTRANTICO',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOTRANTICO official transit seeded: ${cootranticoRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedLolayaOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const lolayaRoutes = collectiveRoutes.filter((route) => route.operatorName === 'LOLAYA');
  for (const route of lolayaRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of lolayaOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_LOLAYA_KMZ_BASE_URL, 'LOLAYA');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = lolayaRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`LOLAYA route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-lolaya-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_LOLAYA_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'LOLAYA',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`LOLAYA official transit seeded: ${lolayaRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCootrasolOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cootrasolRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOTRASOL');
  for (const route of cootrasolRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cootrasolOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOTRASOL_KMZ_BASE_URL, 'COOTRASOL');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cootrasolRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOTRASOL route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cootrasol-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOTRASOL_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOTRASOL',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOTRASOL official transit seeded: ${cootrasolRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedEmbusaOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const embusaRoutes = collectiveRoutes.filter((route) => route.operatorName === 'EMBUSA');
  for (const route of embusaRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of embusaOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_EMBUSA_KMZ_BASE_URL, 'EMBUSA');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = embusaRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`EMBUSA route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-embusa-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_EMBUSA_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'EMBUSA',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`EMBUSA official transit seeded: ${embusaRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCootrabOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cootrabRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOTRAB');
  for (const route of cootrabRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cootrabOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOTRAB_KMZ_BASE_URL, 'COOTRAB');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cootrabRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOTRAB route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cootrab-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOTRAB_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOTRAB',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOTRAB official transit seeded: ${cootrabRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCootranscoOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cootranscoRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOTRANSCO');
  for (const route of cootranscoRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cootranscoOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOTRANSCO_KMZ_BASE_URL, 'COOTRANSCO');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cootranscoRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOTRANSCO route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cootransco-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOTRANSCO_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOTRANSCO',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOTRANSCO official transit seeded: ${cootranscoRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCootransnorteOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cootransnorteRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOTRANSNORTE');
  for (const route of cootransnorteRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cootransnorteOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOTRANSNORTE_KMZ_BASE_URL, 'COOTRANSNORTE');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cootransnorteRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOTRANSNORTE route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cootransnorte-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOTRANSNORTE_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOTRANSNORTE',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOTRANSNORTE official transit seeded: ${cootransnorteRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTransoledadOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const transoledadRoutes = collectiveRoutes.filter((route) => route.operatorName === 'TRANSOLEDAD');
  for (const route of transoledadRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of transoledadOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_TRANSOLEDAD_KMZ_BASE_URL, 'TRANSOLEDAD');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = transoledadRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`TRANSOLEDAD route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-transoledad-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_TRANSOLEDAD_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'TRANSOLEDAD',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`TRANSOLEDAD official transit seeded: ${transoledadRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCootransporcarOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cootransporcarRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOTRANSPORCAR');
  for (const route of cootransporcarRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cootransporcarOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOTRANSPORCAR_KMZ_BASE_URL, 'COOTRANSPORCAR');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cootransporcarRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOTRANSPORCAR route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cootransporcar-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOTRANSPORCAR_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOTRANSPORCAR',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOTRANSPORCAR official transit seeded: ${cootransporcarRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedCoochofalOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const coochofalRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOCHOFAL');
  for (const route of coochofalRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of coochofalOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOCHOFAL_KMZ_BASE_URL, 'COOCHOFAL');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = coochofalRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOCHOFAL route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-coochofal-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOCHOFAL_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOCHOFAL',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOCHOFAL official transit seeded: ${coochofalRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedFlotaAnguloOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const flotaAnguloRoutes = collectiveRoutes.filter((route) => route.operatorName === 'FLOTA-ANGULO');
  for (const route of flotaAnguloRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of flotaAnguloOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_FLOTA_ANGULO_KMZ_BASE_URL, 'FLOTA-ANGULO');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = flotaAnguloRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`FLOTA-ANGULO route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-flota-angulo-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_FLOTA_ANGULO_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'FLOTA-ANGULO',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`FLOTA-ANGULO official transit seeded: ${flotaAnguloRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTrasaliancoOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const trasaliancoRoutes = collectiveRoutes.filter((route) => route.operatorName === 'TRASALIANCO');
  for (const route of trasaliancoRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of trasaliancoOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_TRASALIANCO_KMZ_BASE_URL, 'TRASALIANCO');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = trasaliancoRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`TRASALIANCO route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-trasalianco-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_TRASALIANCO_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'TRASALIANCO',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`TRASALIANCO official transit seeded: ${trasaliancoRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTransmecarOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const transmecarRoutes = collectiveRoutes.filter((route) => route.operatorName === 'TRANSMECAR');
  for (const route of transmecarRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of transmecarOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_TRANSMECAR_KMZ_BASE_URL, 'TRANSMECAR');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = transmecarRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`TRANSMECAR route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-transmecar-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_TRANSMECAR_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'TRANSMECAR',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`TRANSMECAR official transit seeded: ${transmecarRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTransurbarOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const transurbarRoutes = collectiveRoutes.filter((route) => route.operatorName === 'TRANSURBAR');
  for (const route of transurbarRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of transurbarOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_TRANSURBAR_KMZ_BASE_URL, 'TRANSURBAR');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = transurbarRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`TRANSURBAR route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-transurbar-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_TRANSURBAR_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'TRANSURBAR',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`TRANSURBAR official transit seeded: ${transurbarRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedMonterreyOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const monterreyRoutes = collectiveRoutes.filter((route) => route.operatorName === 'MONTERREY');
  for (const route of monterreyRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of monterreyOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_MONTERREY_KMZ_BASE_URL, 'MONTERREY');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = monterreyRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`MONTERREY route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-monterrey-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_MONTERREY_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'MONTERREY',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`MONTERREY official transit seeded: ${monterreyRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedFlotaRojaOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const flotaRojaRoutes = collectiveRoutes.filter((route) => route.operatorName === 'FLOTA-ROJA');
  for (const route of flotaRojaRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of flotaRojaOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_FLOTA_ROJA_KMZ_BASE_URL, 'FLOTA-ROJA');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = flotaRojaRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`FLOTA-ROJA route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-flota-roja-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_FLOTA_ROJA_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'FLOTA-ROJA',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`FLOTA-ROJA official transit seeded: ${flotaRojaRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedLaCarolinaOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const laCarolinaRoutes = collectiveRoutes.filter((route) => route.operatorName === 'LA-CAROLINA');
  for (const route of laCarolinaRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of laCarolinaOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_LA_CAROLINA_KMZ_BASE_URL, 'LA-CAROLINA');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = laCarolinaRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`LA-CAROLINA route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-la-carolina-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_LA_CAROLINA_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'LA-CAROLINA',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`LA-CAROLINA official transit seeded: ${laCarolinaRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTrasalfaOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const trasalfaRoutes = collectiveRoutes.filter((route) => route.operatorName === 'TRASALFA');
  for (const route of trasalfaRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of trasalfaOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_TRASALFA_KMZ_BASE_URL, 'TRASALFA');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = trasalfaRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`TRASALFA route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-trasalfa-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_TRASALFA_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'TRASALFA',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`TRASALFA official transit seeded: ${trasalfaRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedSodetransOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const sodetransRoutes = collectiveRoutes.filter((route) => route.operatorName === 'SODETRANS');
  for (const route of sodetransRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of sodetransOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_SODETRANS_KMZ_BASE_URL, 'SODETRANS');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = sodetransRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`SODETRANS route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-sodetrans-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_SODETRANS_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'SODETRANS',
          operatorGroupName: 'ALIANZA SODIS',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`SODETRANS official transit seeded: ${sodetransRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTransdiazOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const transdiazRoutes = collectiveRoutes.filter((route) => route.operatorName === 'TRANSDIAZ');
  for (const route of transdiazRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of transdiazOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_TRANSDIAZ_KMZ_BASE_URL, 'TRANSDIAZ');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = transdiazRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`TRANSDIAZ route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-transdiaz-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_TRANSDIAZ_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'TRANSDIAZ',
          operatorGroupName: 'ALIANZA SODIS',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`TRANSDIAZ official transit seeded: ${transdiazRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedAlianzaSodisOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await seedSodetransOfficialTransit(dataSource);
  await seedTransdiazOfficialTransit(dataSource);
};

export const seedCooasoatlanOfficialTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const cooasoatlanRoutes = collectiveRoutes.filter((route) => route.operatorName === 'COOASOATLAN');
  for (const route of cooasoatlanRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const officialShape of cooasoatlanOfficialKmzRoutes) {
    const geometry = await fetchOfficialKmzShape(officialShape, AMB_COOASOATLAN_KMZ_BASE_URL, 'COOASOATLAN');
    if (!geometry) {
      continue;
    }

    for (const routeShortName of officialShape.routeShortNames) {
      const route = cooasoatlanRoutes.find((candidate) => candidate.shortName === routeShortName);
      if (!route) {
        console.warn(`COOASOATLAN route ${routeShortName} skipped: route is not in catalog.`);
        continue;
      }

      await upsertShape(dataSource, {
        id: `amb-official-cooasoatlan-${normalizeId(routeShortName)}`,
        routeId: route.id,
        sourceKind: 'official_web',
        sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
        geometry,
        metadata: {
          sourceUrl: getKmzSourceUrl(officialShape.fileName, AMB_COOASOATLAN_KMZ_BASE_URL),
          sourceFileName: officialShape.fileName,
          sourceAuthority: 'Area Metropolitana de Barranquilla',
          operatorName: 'COOASOATLAN',
          geometryStatus: 'official_amb_kmz_linestring',
          sharedOfficialRouteFamily: officialShape.routeShortNames.length > 1,
          points: geometry.coordinates.length,
        },
      });
      shapesCount += 1;
    }
  }

  console.log(`COOASOATLAN official transit seeded: ${cooasoatlanRoutes.length} catalog routes, ${shapesCount} official KMZ shapes.`);
};

export const seedTransmetroPendingTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const transmetroCatalogRoutes = [
    ...transmetroTrunkRoutes,
    ...transmetroRoutes,
  ];

  for (const route of transmetroCatalogRoutes) {
    await upsertRoute(dataSource, route);
  }

  let shapesCount = 0;
  for (const alias of transmetroPendingShapeAliases) {
    const inserted = await upsertShapeAliasFromExistingRoute(dataSource, alias);
    if (!inserted) {
      console.warn(`TRANSMETRO route ${alias.routeId} skipped: source route ${alias.sourceRouteId} shape is not available.`);
      continue;
    }

    shapesCount += 1;
  }

  console.log(`TRANSMETRO pending transit seeded: ${transmetroCatalogRoutes.length} catalog routes, ${shapesCount} secondary reference shapes.`);
};

const toOsmShape = (
  relation: OverpassElement,
  wayShapeInfoById: Map<number, WayShapeInfo>
): TransitShapeSeed | null => {
  const wayMembers = relation.members?.filter((member) => member.type === 'way') ?? [];
  const coordinates = dedupeConsecutiveCoordinates(
    wayMembers.flatMap((member) => wayShapeInfoById.get(member.ref)?.coordinates ?? [])
  );
  const streets = Array.from(new Set(
    wayMembers
      .map((member) => wayShapeInfoById.get(member.ref)?.streetName)
      .filter((streetName): streetName is string => Boolean(streetName))
  ));

  if (coordinates.length < 3) {
    return null;
  }

  return {
    id: `osm-shape-${relation.id}`,
    routeId: `osm-relation-${relation.id}`,
    sourceKind: 'osm_overpass',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
    geometry: {
      type: 'LineString',
      coordinates,
    },
    metadata: {
      relationId: relation.id,
      wayMembersCount: wayMembers.length,
      geometryStatus: 'osm_relation_member_ways',
      streets,
    },
  };
};

const parseXmlAttributes = (source: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attributeRegex.exec(source)) !== null) {
    attributes[match[1]] = match[2]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  return attributes;
};

const parseOsmRelationFullXml = (
  relationId: number,
  xml: string,
): TransitShapeSeed | null => {
  const nodeCoordinatesById = new Map<string, CoordinateTuple>();
  const nodeRegex = /<node\b([^>]*)\/>|<node\b([^>]*)>[\s\S]*?<\/node>/g;
  let nodeMatch: RegExpExecArray | null;

  while ((nodeMatch = nodeRegex.exec(xml)) !== null) {
    const attributes = parseXmlAttributes(nodeMatch[1] ?? nodeMatch[2] ?? '');
    const id = attributes.id;
    const latitude = Number(attributes.lat);
    const longitude = Number(attributes.lon);

    if (id && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      nodeCoordinatesById.set(id, [longitude, latitude]);
    }
  }

  const wayShapeInfoById = new Map<number, WayShapeInfo>();
  const wayRegex = /<way\b([^>]*)>([\s\S]*?)<\/way>/g;
  let wayMatch: RegExpExecArray | null;

  while ((wayMatch = wayRegex.exec(xml)) !== null) {
    const wayAttributes = parseXmlAttributes(wayMatch[1] ?? '');
    const wayId = Number(wayAttributes.id);
    const body = wayMatch[2] ?? '';

    if (!Number.isFinite(wayId)) {
      continue;
    }

    const ndRefs = Array.from(body.matchAll(/<nd\b([^>]*)\/>/g))
      .map((match) => parseXmlAttributes(match[1] ?? '').ref)
      .filter((ref): ref is string => Boolean(ref));
    const coordinates = ndRefs
      .map((ref) => nodeCoordinatesById.get(ref))
      .filter((coordinate): coordinate is CoordinateTuple => Boolean(coordinate));
    const streetName = Array.from(body.matchAll(/<tag\b([^>]*)\/>/g))
      .map((match) => parseXmlAttributes(match[1] ?? ''))
      .find((attributes) => attributes.k === 'name')?.v;

    if (coordinates.length > 1) {
      wayShapeInfoById.set(wayId, { coordinates, streetName });
    }
  }

  const relationMatch = xml.match(new RegExp(`<relation\\b[^>]*id="${relationId}"[^>]*>([\\s\\S]*?)<\\/relation>`));
  const relationBody = relationMatch?.[1];
  if (!relationBody) {
    return null;
  }

  const wayMembers = Array.from(relationBody.matchAll(/<member\b([^>]*)\/>/g))
    .map((match) => parseXmlAttributes(match[1] ?? ''))
    .filter((attributes) => attributes.type === 'way' && attributes.ref)
    .map((attributes) => Number(attributes.ref))
    .filter((ref) => Number.isFinite(ref));
  const coordinates = dedupeConsecutiveCoordinates(
    wayMembers.flatMap((wayId) => wayShapeInfoById.get(wayId)?.coordinates ?? [])
  );
  const streets = Array.from(new Set(
    wayMembers
      .map((wayId) => wayShapeInfoById.get(wayId)?.streetName)
      .filter((streetName): streetName is string => Boolean(streetName))
  ));

  if (coordinates.length < 3) {
    return null;
  }

  return {
    id: `osm-shape-${relationId}`,
    routeId: `osm-relation-${relationId}`,
    sourceKind: 'osm_overpass',
    sourceSnapshotId: TRANSIT_SOURCE_SNAPSHOT_ID,
    geometry: {
      type: 'LineString',
      coordinates,
    },
    metadata: {
      relationId,
      wayMembersCount: wayMembers.length,
      geometryStatus: 'osm_api_relation_full',
      streets,
    },
  };
};

const fetchOsmRelationFullShape = async (relationId: number): Promise<TransitShapeSeed | null> => {
  const response = await fetch(`${OSM_API_URL}/relation/${relationId}/full`, {
    headers: {
      'User-Agent': 'QuillaMap/1.0 zero-cost-transit-seed',
    },
  });

  if (!response.ok) {
    console.warn(`OSM relation ${relationId} skipped: ${response.status}`);
    return null;
  }

  return parseOsmRelationFullXml(relationId, await response.text());
};

const seedShapesFromExistingOsmRelations = async (dataSource: DataSource): Promise<number> => {
  const rows = await dataSource.query(
    `
    select replace(id, 'osm-relation-', '') as relation_id
    from public.transit_routes
    where id like 'osm-relation-%'
    order by id
    limit $1
    `,
    [OSM_RELATION_SHAPE_LIMIT],
  ) as ExistingOsmRelationRow[];
  let count = 0;

  for (const row of rows) {
    const relationId = Number(row.relation_id);
    if (!Number.isFinite(relationId)) {
      continue;
    }

    const shape = await fetchOsmRelationFullShape(relationId);
    if (!shape) {
      continue;
    }

    await upsertShape(dataSource, shape);
    count += 1;
  }

  return count;
};

export const seedTransit = async (dataSource: DataSource): Promise<void> => {
  await ensureTransitSchema(dataSource);

  const officialRoutes = [
    ...manualBootstrapRoutes,
    ...transmetroTrunkRoutes,
    ...transmetroRoutes,
    ...collectiveRoutes,
    ...metropolitanReferenceRoutes,
    ...sobusaReferenceRoutes,
  ];

  for (const route of officialRoutes) {
    await upsertRoute(dataSource, route);
  }

  let osmRoutesCount = 0;
  let osmStopsCount = 0;
  const overpassTransit = await fetchOverpassTransit();
  const overpassElements = overpassTransit?.elements ?? [];
  const wayShapeInfoById = getWayShapeInfoById(overpassElements);

  for (const element of overpassElements) {
    if (element.type === 'relation') {
      const route = toOsmRoute(element);
      if (!route) {
        continue;
      }

      await upsertRoute(dataSource, route);
      osmRoutesCount += 1;
      continue;
    }

    if (element.type === 'node') {
      const stop = toOsmStop(element);
      if (!stop) {
        continue;
      }

      await upsertStop(dataSource, stop);
      osmStopsCount += 1;
    }
  }

  let osmShapesCount = 0;
  for (const element of overpassElements) {
    if (element.type !== 'relation') {
      continue;
    }

    const route = toOsmRoute(element);
    const shape = route ? toOsmShape(element, wayShapeInfoById) : null;
    if (!shape) {
      continue;
    }

    await upsertShape(dataSource, shape);
    osmShapesCount += 1;
  }

  if (osmShapesCount === 0) {
    osmShapesCount = await seedShapesFromExistingOsmRelations(dataSource);
  }

  console.log(
    `Transit seeded: ${officialRoutes.length} catalog routes, ${osmRoutesCount} OSM routes, ${osmStopsCount} OSM stops, ${osmShapesCount} OSM shapes.`,
  );
};
