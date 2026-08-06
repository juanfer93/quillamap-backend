import 'dotenv/config';
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const lat = Number(process.argv[2] ?? 10.982);
const lng = Number(process.argv[3] ?? -74.781);
const radius = Number(process.argv[4] ?? 5000);

try {
  await client.connect();

  const summary = await client.query(
    `
    select
      count(*)::int as total,
      count(*) filter (where status = 'activo')::int as active,
      count(*) filter (where "createdAt" >= now() - interval '60 minutes')::int as recent,
      count(*) filter (where expires_at is null or expires_at > now())::int as unexpired,
      count(*) filter (
        where ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      )::int as nearby
    from report
    where type = 'inseguridad'
      and description like '[security-heatmap-seed]%'
    `,
    [lng, lat, radius],
  );

  const clusters = await client.query(
    `
    with eligible as (
      select
        id,
        ST_Transform(location::geometry, 3857) as geom
      from report
      where type = 'inseguridad'
        and status = 'activo'
        and description like '[security-heatmap-seed]%'
        and "createdAt" >= now() - interval '60 minutes'
        and (expires_at is null or expires_at > now())
        and ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
    )
    select cluster_id, count(*)::int as total
    from (
      select ST_ClusterDBSCAN(geom, eps := 804.672, minpoints := 2) over () as cluster_id
      from eligible
    ) clustered
    group by cluster_id
    order by cluster_id
    `,
    [lng, lat, radius],
  );

  console.log(JSON.stringify({
    query: { lat, lng, radius },
    summary: summary.rows[0],
    clusters: clusters.rows,
  }, null, 2));
} finally {
  await client.end();
}
