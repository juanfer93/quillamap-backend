export function buildUnifiedPlacesQuery(
  includeTouristSites: boolean,
  includeCategory: boolean,
): string {
  const categoryPredicate = includeCategory ? 'and category::text = $4' : '';
  const limitPlaceholder = includeCategory ? '$5' : '$4';
  const touristSitesSelect = includeTouristSites
    ? `
        union all
        select
          id::text,
          name,
          description,
          category::text as category,
          'tourist_site'::text as source,
          ST_AsGeoJSON(location)::jsonb as location,
          metadata,
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude,
          ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters,
          "createdAt" as created_at
        from tourist_sites
        where ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          ${categoryPredicate}
      `
    : '';

  return `
      with unified_places as (
        select
          id::text,
          name,
          description,
          category::text,
          'place'::text as source,
          ST_AsGeoJSON(location)::jsonb as location,
          metadata,
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude,
          ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters,
          "createdAt" as created_at
        from places
        where ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          ${categoryPredicate}
        ${touristSitesSelect}
      )
      select *
      from unified_places
      order by distance_meters asc, created_at desc nulls last
      limit ${limitPlaceholder}
    `;
}
