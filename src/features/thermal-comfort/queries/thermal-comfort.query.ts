export const THERMAL_COMFORT_QUERY = `
      with route as (
        select ST_SetSRID(ST_GeomFromGeoJSON($3), 4326) as geom
      ),
      route_segments as (
        select dumped.path[1] as segment_index, dumped.geom as geom
        from route
        cross join lateral ST_DumpSegments(route.geom) as dumped(path, geom)
      ),
      community_segments as (
        select distinct
          concat('shade-report-', report.id::text, '-', route_segments.segment_index::text) as id,
          'community_report' as source,
          route_segments.geom
        from route_segments
        join report
          on report.type = $1
          and report.status = $2
          and ST_DWithin(report.location, route_segments.geom::geography, $4)
      ),
      park_segments as (
        select distinct
          concat('green-coverage-', coverage.id::text, '-', route_segments.segment_index::text) as id,
          case when coverage.type = 'park' then 'park' else 'green_coverage' end as source,
          route_segments.geom
        from route_segments
        join amb_green_coverage coverage
          on coverage.type in ('tree', 'park', 'grass')
          and ST_DWithin(
            coverage.geometry,
            route_segments.geom::geography,
            $5
          )
      ),
      matched_segments as (
        select * from community_segments
        union all
        select * from park_segments
      )
      select
        (select count(distinct id)::int from community_segments) as matched_shade_reports,
        (select count(distinct id)::int from park_segments) as matched_parks,
        case
          when count(*) = 0 then -$8::int
          else
            (select count(distinct id)::int from community_segments) * $6::int +
            (select count(distinct id)::int from park_segments) * $7::int
        end as shade_score_seconds,
        case when count(*) = 0 then $8::int else 0 end as heat_penalty_seconds,
        coalesce(
          json_agg(
            json_build_object(
              'id', id,
              'source', source,
              'geometry', ST_AsGeoJSON(geom)::json
            )
            order by id
          ) filter (where id is not null),
          '[]'::json
        ) as shade_segments
      from matched_segments
      `;
