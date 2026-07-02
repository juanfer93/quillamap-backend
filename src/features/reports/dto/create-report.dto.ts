import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsEnum,
  IsNumber,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'geojson';
import { ReportType } from '@/features/reports/entities/report-type.enum';

class IsLngLatCoordinate {
  validate(value: unknown): boolean {
    if (!Array.isArray(value) || value.length !== 2) {
      return false;
    }

    const [longitude, latitude] = value;

    return (
      typeof longitude === 'number'
      && Number.isFinite(longitude)
      && longitude >= -180
      && longitude <= 180
      && typeof latitude === 'number'
      && Number.isFinite(latitude)
      && latitude >= -90
      && latitude <= 90
    );
  }

  defaultMessage(): string {
    return 'location.coordinates must be [longitude, latitude] in SRID 4326';
  }
}

class GeoJsonPointDto implements Point {
  @ApiProperty({ example: 'Point' })
  @Equals('Point')
  type: 'Point';

  @ApiProperty({
    description: 'Coordinates in [longitude, latitude] order for SRID 4326',
    example: [-74.79, 10.99],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Validate(IsLngLatCoordinate)
  @Type(() => Number)
  coordinates: [number, number];
}

export class CreateReportDto {
  @ApiProperty({
    description: 'Type of the report',
    enum: ReportType,
    example: ReportType.ARROYO,
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({
    description: 'Description of the report',
    example: 'Arroyo peligroso en la via',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'GeoJSON Point for the report location',
    example: { type: 'Point', coordinates: [-74.79, 10.99] },
    type: Object,
  })
  @ValidateNested()
  @Type(() => GeoJsonPointDto)
  location: Point;
}
