export const TRANSIT_ROUTE_STREETS_QUERY = `
      select
        r.id as route_id,
        r.short_name,
        r.long_name,
        r.agency_kind,
        r.source_kind as route_source_kind,
        r.operator_name,
        r.metadata as route_metadata,
        s.id as shape_id,
        s.source_kind as shape_source_kind,
        s.metadata as shape_metadata,
        case
          when s.geom is null then null
          else ST_NPoints(s.geom)
        end as coordinates_count
      from public.transit_routes r
      left join public.transit_shapes s on s.route_id = r.id
      where lower(r.id) = lower($1)
      or lower(r.short_name) = lower($1)
      order by s.id asc
      `;
