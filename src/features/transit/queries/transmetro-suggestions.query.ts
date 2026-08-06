export const TRANSMETRO_SUGGESTIONS_QUERY = `
      with points as (
        select
          ST_SetSRID(ST_MakePoint($1, $2), 4326) as origin_geom,
          ST_SetSRID(ST_MakePoint($3, $4), 4326) as destination_geom
      ),
      transmetro_shapes as (
        select
          r.id as route_id,
          r.short_name,
          r.long_name,
          r.source_kind,
          r.operator_name,
          r.metadata as route_metadata,
          s.id as shape_id,
          s.geom
        from public.transit_shapes s
        inner join public.transit_routes r on r.id = s.route_id
        where r.agency_kind = 'transmetro'
        and coalesce((r.metadata->>'isCurrentlyOperatingOverride')::boolean, true) = true
      ),
      nearby_feeders as (
        select
          feeder.*,
          boarding_stop.id as boarding_stop_id,
          boarding_stop.name as boarding_stop_name,
          boarding_stop.geom as boarding_stop_geom,
          ST_Distance(boarding_stop.geom::geography, points.origin_geom::geography) as origin_walk_meters
        from transmetro_shapes feeder
        cross join points
        join lateral (
          select st.id, st.name, st.geom
          from public.transit_stops st
          where st.name ilike '%' || feeder.short_name || '%'
          and ST_DWithin(st.geom::geography, feeder.geom::geography, $5)
          and ST_DWithin(st.geom::geography, points.origin_geom::geography, $6)
          order by ST_Distance(st.geom::geography, points.origin_geom::geography) asc
          limit 1
        ) boarding_stop on true
        order by origin_walk_meters asc
        limit 8
      ),
      nearby_trunks as (
        select
          trunk.*,
          destination_stop.id as destination_stop_id,
          destination_stop.name as destination_stop_name,
          destination_stop.geom as destination_stop_geom,
          ST_Distance(destination_stop.geom::geography, points.destination_geom::geography) as destination_walk_meters
        from transmetro_shapes trunk
        cross join points
        join lateral (
          select st.id, st.name, st.geom
          from public.transit_stops st
          where ST_DWithin(st.geom::geography, trunk.geom::geography, $5)
          and ST_DWithin(st.geom::geography, points.destination_geom::geography, $6)
          order by
            case
              when lower(st.name) like '%estadio%' or lower(st.name) like '%joaqu%' then 0
              when lower(st.name) like '%estaci%' then 1
              when lower(st.name) like '%portal%' then 2
              when lower(st.name) like '%parada transmetro%' then 3
              else 4
            end asc,
            ST_Distance(st.geom::geography, points.destination_geom::geography) asc
          limit 1
        ) destination_stop on true
        order by destination_walk_meters asc
        limit 10
      ),
      candidates as (
        select
          feeder.route_id as feeder_route_id,
          feeder.short_name as feeder_short_name,
          feeder.long_name as feeder_long_name,
          feeder.source_kind as feeder_source_kind,
          feeder.operator_name as feeder_operator_name,
          feeder.route_metadata as feeder_route_metadata,
          trunk.route_id as trunk_route_id,
          trunk.short_name as trunk_short_name,
          trunk.long_name as trunk_long_name,
          trunk.source_kind as trunk_source_kind,
          trunk.operator_name as trunk_operator_name,
          trunk.route_metadata as trunk_route_metadata,
          feeder.boarding_stop_id,
          feeder.boarding_stop_name,
          feeder.boarding_stop_geom,
          transfer_stop.id as transfer_stop_id,
          transfer_stop.name as transfer_stop_name,
          transfer_stop.geom as transfer_stop_geom,
          trunk.destination_stop_id,
          trunk.destination_stop_name,
          trunk.destination_stop_geom,
          feeder.origin_walk_meters,
          trunk.destination_walk_meters,
          ST_LineLocatePoint(feeder.geom, ST_ClosestPoint(feeder.geom, feeder.boarding_stop_geom)) as feeder_board_fraction,
          ST_LineLocatePoint(feeder.geom, ST_ClosestPoint(feeder.geom, transfer_stop.geom)) as feeder_transfer_fraction,
          ST_LineLocatePoint(trunk.geom, ST_ClosestPoint(trunk.geom, transfer_stop.geom)) as trunk_transfer_fraction,
          ST_LineLocatePoint(trunk.geom, ST_ClosestPoint(trunk.geom, trunk.destination_stop_geom)) as trunk_destination_fraction,
          feeder.geom as feeder_geom,
          trunk.geom as trunk_geom
        from nearby_feeders feeder
        join nearby_trunks trunk on trunk.route_id <> feeder.route_id
        join lateral (
          select st.id, st.name, st.geom
          from public.transit_stops st
          where ST_DWithin(st.geom::geography, feeder.geom::geography, $5)
          and ST_DWithin(st.geom::geography, trunk.geom::geography, $5)
          and (
            lower(st.name) like '%estaci%'
            or lower(st.name) like '%portal%'
            or lower(st.name) like '%retorno%'
            or lower(st.name) like '%transmetro%'
          )
          order by
            case
              when lower(st.name) like '%joe arroyo%' then 0
              when lower(st.name) like '%estaci%' then 1
              when lower(st.name) like '%portal%' then 2
              else 3
            end asc,
            ST_Distance(st.geom::geography, feeder.geom::geography) + ST_Distance(st.geom::geography, trunk.geom::geography) asc
          limit 1
        ) transfer_stop on true
      )
      select
        feeder_route_id,
        feeder_short_name,
        feeder_long_name,
        feeder_source_kind,
        feeder_operator_name,
        feeder_route_metadata,
        trunk_route_id,
        trunk_short_name,
        trunk_long_name,
        trunk_source_kind,
        trunk_operator_name,
        trunk_route_metadata,
        boarding_stop_id,
        boarding_stop_name,
        ST_AsGeoJSON(boarding_stop_geom)::json as boarding_stop_point,
        transfer_stop_id,
        transfer_stop_name,
        ST_AsGeoJSON(transfer_stop_geom)::json as transfer_stop_point,
        destination_stop_id,
        destination_stop_name,
        ST_AsGeoJSON(destination_stop_geom)::json as destination_stop_point,
        round(origin_walk_meters)::int as origin_walk_meters,
        round(destination_walk_meters)::int as destination_walk_meters,
        round(ST_Length(ST_LineSubstring(
          feeder_geom,
          LEAST(feeder_board_fraction, feeder_transfer_fraction),
          GREATEST(feeder_board_fraction, feeder_transfer_fraction)
        )::geography))::int as feeder_distance_meters,
        round(ST_Length(ST_LineSubstring(
          trunk_geom,
          LEAST(trunk_transfer_fraction, trunk_destination_fraction),
          GREATEST(trunk_transfer_fraction, trunk_destination_fraction)
        )::geography))::int as trunk_distance_meters
      from candidates
      order by
        case
          when feeder_board_fraction <= feeder_transfer_fraction
          and trunk_transfer_fraction <= trunk_destination_fraction then 0
          else 1
        end asc,
        origin_walk_meters asc,
        destination_walk_meters asc,
        feeder_distance_meters asc,
        trunk_distance_meters asc
      limit $7
      `;
