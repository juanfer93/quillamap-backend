import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import type { Geometry, LineString, MultiPolygon, Point, Polygon } from 'geojson';
import { GreenCoverageSource } from '../entities/green-coverage-source.enum';
import { GreenCoverageType } from '../entities/green-coverage-type.enum';

type SupportedGreenGeometry = Point | LineString | Polygon | MultiPolygon;

const AMB_BOUNDS = {
  minLatitude: 10.82,
  maxLatitude: 11.12,
  minLongitude: -75.1,
  maxLongitude: -74.68,
} as const;

const isLngLat = (value: unknown): value is [number, number] => {
  if (!Array.isArray(value) || value.length < 2) {
    return false;
  }

  const [longitude, latitude] = value;

  return typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= AMB_BOUNDS.minLongitude &&
    longitude <= AMB_BOUNDS.maxLongitude &&
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= AMB_BOUNDS.minLatitude &&
    latitude <= AMB_BOUNDS.maxLatitude;
};

const collectCoordinates = (coordinates: unknown): unknown[] => {
  if (isLngLat(coordinates)) {
    return [coordinates];
  }

  if (!Array.isArray(coordinates)) {
    return [];
  }

  return coordinates.flatMap(collectCoordinates);
};

class IsAmbGreenGeometry {
  validate(value: Geometry): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (!['Point', 'LineString', 'Polygon', 'MultiPolygon'].includes(value.type)) {
      return false;
    }

    const coordinates = collectCoordinates((value as SupportedGreenGeometry).coordinates);
    return coordinates.length > 0 && coordinates.every(isLngLat);
  }

  defaultMessage(): string {
    return 'geometry must be Point, LineString, Polygon or MultiPolygon coordinates inside the AMB bounding box using SRID 4326 [longitude, latitude] order';
  }
}

export class CreateGreenCoverageDto {
  @ApiProperty({ enum: GreenCoverageType, example: GreenCoverageType.TREE })
  @IsEnum(GreenCoverageType)
  type: GreenCoverageType;

  @ApiPropertyOptional({ enum: GreenCoverageSource, example: GreenCoverageSource.OVERPASS })
  @IsOptional()
  @IsEnum(GreenCoverageSource)
  source?: GreenCoverageSource;

  @ApiPropertyOptional({ example: 'node/123456789' })
  @IsOptional()
  @IsString()
  osmId?: string;

  @ApiPropertyOptional({ example: 'Parque Sagrado Corazon' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Raw Overpass tags', type: Object })
  @IsOptional()
  @IsObject()
  tags?: Record<string, unknown>;

  @ApiProperty({
    description: 'GeoJSON geometry in SRID 4326 and [longitude, latitude] order',
    example: { type: 'Point', coordinates: [-74.79, 10.99] },
    type: Object,
  })
  @Validate(IsAmbGreenGeometry)
  @Type(() => Object)
  geometry: Geometry;
}
