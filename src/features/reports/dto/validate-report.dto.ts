import { Type } from 'class-transformer';
import { IsBoolean, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { Point } from 'geojson';
import { GeoJsonPointDto } from '@/features/reports/dto/create-report.dto';

export class ValidateReportDto {
  @ApiProperty({ description: 'Whether the user confirms the incident' })
  @IsBoolean()
  isConfirmed: boolean;

  @ApiProperty({
    description: 'Current device location for 500m anti-spoofing checks',
    example: { type: 'Point', coordinates: [-74.79, 10.99] },
    type: Object,
  })
  @ValidateNested()
  @Type(() => GeoJsonPointDto)
  userLocation: Point;
}
