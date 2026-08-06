import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Point } from 'geojson';
import { Repository } from 'typeorm';
import {
  Place,
  PlaceMetadata,
  PlaceLocalizedText,
} from './entities/place.entity';
import { PlaceCategory } from './entities/place-category.enum';
import type { GetPlacesFilterDto } from './dto/get-places-filter.dto';
import { buildUnifiedPlacesQuery } from '@/features/places/queries/unified-places.query';

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
    const rawRows: unknown = await this.placeRepository.query(
      buildUnifiedPlacesQuery(hasTouristSites, Boolean(category)),
      params,
    );
    const rows = rawRows as RawPlaceRow[];

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
    const rawRows: unknown = await this.placeRepository.query(
      "select to_regclass('public.tourist_sites') as table_name",
    );
    const [result] = rawRows as Array<{ table_name: string | null }>;

    return Boolean(result?.table_name);
  }
}
