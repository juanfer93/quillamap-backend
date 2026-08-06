export const TRANSIT_BUS_SUGGESTIONS_QUERY = `
      with points as (
        select
          ST_SetSRID(ST_MakePoint($1, $2), 4326) as origin_geom,
          ST_SetSRID(ST_MakePoint($3, $4), 4326) as destination_geom
      ),
      candidates as (
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
          ST_Distance(s.geom::geography, p.origin_geom::geography) as origin_walk_meters,
          ST_Distance(s.geom::geography, p.destination_geom::geography) as destination_walk_meters,
          ST_LineLocatePoint(s.geom, ST_ClosestPoint(s.geom, p.origin_geom)) as origin_fraction,
          ST_LineLocatePoint(s.geom, ST_ClosestPoint(s.geom, p.destination_geom)) as destination_fraction,
          ST_ClosestPoint(s.geom, p.origin_geom) as boarding_geom,
          ST_ClosestPoint(s.geom, p.destination_geom) as alighting_geom
        from public.transit_shapes s
        inner join public.transit_routes r on r.id = s.route_id
        cross join points p
        where ST_DWithin(s.geom::geography, p.origin_geom::geography, $5)
        and ST_DWithin(s.geom::geography, p.destination_geom::geography, $5)
        and r.agency_kind = 'colectivo'
      )
      select
        route_id,
        short_name,
        long_name,
        agency_kind,
        route_source_kind,
        operator_name,
        route_metadata,
        shape_id,
        shape_source_kind,
        shape_metadata,
        round(origin_walk_meters)::int as origin_walk_meters,
        round(destination_walk_meters)::int as destination_walk_meters,
        round(origin_walk_meters + destination_walk_meters)::int as total_walk_meters,
        round(ST_Length(ST_LineSubstring(
          (select geom from public.transit_shapes where id = candidates.shape_id),
          LEAST(origin_fraction, destination_fraction),
          GREATEST(origin_fraction, destination_fraction)
        )::geography))::int as bus_distance_meters,
        round(origin_walk_meters + destination_walk_meters + ST_Length(ST_LineSubstring(
          (select geom from public.transit_shapes where id = candidates.shape_id),
          LEAST(origin_fraction, destination_fraction),
          GREATEST(origin_fraction, destination_fraction)
        )::geography))::int as total_distance_meters,
        origin_fraction,
        destination_fraction,
        ST_AsGeoJSON(boarding_geom)::json as boarding_point,
        ST_AsGeoJSON(alighting_geom)::json as alighting_point
      from candidates
      order by total_walk_meters asc, bus_distance_meters asc
      limit $6
      `;
