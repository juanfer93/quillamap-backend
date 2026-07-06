import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Point } from 'geojson';
import { Repository } from 'typeorm';
import { Place, PlaceMetadata, PlaceLocalizedText } from './entities/place.entity';
import { PlaceCategory } from './entities/place-category.enum';
import type { GetPlacesFilterDto } from './dto/get-places-filter.dto';

export interface PlaceMapFeature {
  id: string;
  name: PlaceLocalizedText;
  description?: PlaceLocalizedText | null;
  category: PlaceCategory;
  source: 'place' | 'tourist_site';
  location: Point;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  metadata?: PlaceMetadata | null;
}

interface RawPlaceRow {
  id: string;
  name: PlaceLocalizedText;
  description?: PlaceLocalizedText | null;
  category: PlaceCategory;
  source: 'place' | 'tourist_site';
  location: Point;
  metadata?: PlaceMetadata | null;
  latitude: string | number;
  longitude: string | number;
  distance_meters?: string | number;
  created_at?: Date;
}

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
  ) {}

  async findNearby(filter: GetPlacesFilterDto): Promise<PlaceMapFeature[]> {
    const { lat, lng, radius = 2500, category, limit = 180 } = filter;
    const hasTouristSites = await this.hasTouristSitesTable();
    const params = category
      ? [lng, lat, radius, category, limit]
      : [lng, lat, radius, limit];
    const rows = await this.placeRepository.query(
      this.buildUnifiedPlacesQuery(hasTouristSites, Boolean(category)),
      params,
    ) as RawPlaceRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      source: row.source,
      location: row.location,
      coordinate: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      },
      metadata: row.metadata,
    }));
  }

  private async hasTouristSitesTable(): Promise<boolean> {
    const [result] = await this.placeRepository.query(
      "select to_regclass('public.tourist_sites') as table_name",
    ) as Array<{ table_name: string | null }>;

    return Boolean(result?.table_name);
  }

  private buildUnifiedPlacesQuery(includeTouristSites: boolean, includeCategory: boolean): string {
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
}
