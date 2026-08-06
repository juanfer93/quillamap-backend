import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetSecurityHeatmapDto {
  @ApiProperty({ description: "User's current latitude", example: 10.987 })
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: "User's current longitude", example: -74.789 })
  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @ApiPropertyOptional({
    description: 'Radius in meters to search for security heatmap reports',
    example: 2000,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(300)
  @Max(5000)
  radius?: number;

  @ApiPropertyOptional({
    description:
      'Limit output to nearby critical clusters for driving lock rendering.',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  criticalOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Driving lock proximity radius in meters. Used only when criticalOnly is true.',
    example: 500,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(300)
  @Max(500)
  proximityRadius?: number;
}
