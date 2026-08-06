import 'dotenv/config';
import { Client } from 'pg';

const EVIDENCE_PATTERN = '%/storage/v1/object/public/evidence/%';
const AMB_BBOX_WKT =
  'SRID=4326;POLYGON((-75.1 10.82,-74.68 10.82,-74.68 11.12,-75.1 11.12,-75.1 10.82))';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to audit security heatmap data.');
  process.exit(1);
}

try {
  await client.connect();

  const schemaAudit = await client.query(
    `
    select
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'report'
          and column_name = 'danger_level'
      ) as has_danger_level,
      exists (
        select 1
        from pg_type t
        inner join pg_enum e on e.enumtypid = t.oid
        where t.typname = 'report_type_enum'
          and e.enumlabel = 'inseguridad'
      ) as has_inseguridad_type,
      to_regclass('public.zones') is not null as has_zones_table,
      to_regclass('public.traffic_cameras') is not null as has_traffic_cameras,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'traffic_cameras'
          and column_name = 'verified'
      ) as has_camera_verified,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'traffic_cameras'
          and column_name = 'infrastructure_type'
      ) as has_infrastructure_type
    `,
  );

  const { has_danger_level: hasDangerLevel } = schemaAudit.rows[0];
  const {
    has_zones_table: hasZonesTable,
    has_camera_verified: hasCameraVerified,
    has_infrastructure_type: hasInfrastructureType,
  } = schemaAudit.rows[0];

  const reportAudit = hasDangerLevel
    ? await client.query(
    `
    select
      count(*)::int as total,
      count(*) filter (where danger_level between 1 and 5)::int as valid_danger_level,
      count(*) filter (where image_url like $1)::int as with_storage_evidence,
      min("createdAt") as oldest_report,
      max("createdAt") as newest_report
    from report
    where type = $2
    `,
      [EVIDENCE_PATTERN, 'inseguridad'],
    )
    : await client.query(
      `
      select
        count(*)::int as total,
        null::int as valid_danger_level,
        count(*) filter (where image_url like $1)::int as with_storage_evidence,
        min("createdAt") as oldest_report,
        max("createdAt") as newest_report
      from report
      where type::text = $2
      `,
      [EVIDENCE_PATTERN, 'inseguridad'],
    );

  const indexAudit = await client.query(
    `
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('report', 'report_validations', 'profile', 'zones', 'traffic_cameras')
      and (
        indexname like '%gist%'
        or indexname like '%security_heatmap%'
        or indexname like '%report_negative%'
        or indexname like '%karma%'
      )
    order by tablename, indexname
    `,
  );

  const dangerLevelAudit = hasDangerLevel
    ? await client.query(
      `
      select danger_level, count(*)::int as total
      from report
      where type = $1
        and ST_Intersects(location::geometry, ST_GeomFromEWKT($2))
      group by danger_level
      order by danger_level
      `,
      ['inseguridad', AMB_BBOX_WKT],
    )
    : { rows: [] };

  const zoneAudit = hasZonesTable
    ? await client.query(
      `select count(*)::int as civil_risk_zones
       from zones
       where rules->'security' is not null`,
    )
    : { rows: [{ civil_risk_zones: null }] };

  const cameraAudit = hasCameraVerified && hasInfrastructureType
    ? await client.query(
      `select
        count(*) filter (where infrastructure_type = 'traffic_camera')::int
          as verified_cameras,
        count(*) filter (where infrastructure_type = 'cultural_landmark')::int
          as verified_cultural_landmarks
       from traffic_cameras
       where verified = true and verification_score = 1`,
    )
    : { rows: [{ verified_cameras: null, verified_cultural_landmarks: null }] };

  console.log(JSON.stringify({
    schema: schemaAudit.rows[0],
    reports: reportAudit.rows[0],
    dangerLevelsInAmb: dangerLevelAudit.rows,
    infrastructure: {
      ...zoneAudit.rows[0],
      ...cameraAudit.rows[0],
    },
    indexes: indexAudit.rows,
  }, null, 2));
} finally {
  await client.end();
}
