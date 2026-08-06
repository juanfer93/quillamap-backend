export const TRANSIT_MAP_ROUTES_QUERY = `
        select
          s.id,
          s.route_id,
          r.short_name,
          r.long_name,
          r.agency_kind,
          r.source_kind,
          r.operator_name,
          r.metadata as route_metadata,
          coalesce(
            (
              select jsonb_agg(street.value)
              from jsonb_array_elements_text(coalesce(s.metadata->'streets', '[]'::jsonb)) as street(value)
            ),
            '[]'::jsonb
          ) as streets,
          ST_AsGeoJSON(s.geom)::json as geometry
        from transit_shapes s
        inner join transit_routes r on r.id = s.route_id
        order by r.agency_kind asc, r.short_name asc, s.id asc
        limit $1
        `;

export const TRANSIT_MAP_STOPS_QUERY = `
        select
          s.id,
          s.route_id,
          s.name,
          s.agency_kind,
          coalesce(r.source_kind, 'osm_overpass') as source_kind,
          ST_AsGeoJSON(s.geom)::json as geometry
        from transit_stops s
        left join transit_routes r on r.id = s.route_id
        order by s.name asc, s.id asc
        limit $1
        `;
