import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { GreenCoverageType } from '../entities/green-coverage-type.enum';

export class GetGreenCoverageFilterDto {
  @ApiProperty({ description: "User's current latitude inside the AMB", example: 10.987 })
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: "User's current longitude inside the AMB", example: -74.789 })
  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @ApiPropertyOptional({ description: 'Radius in meters to search green coverage', example: 2000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(100)
  @Max(5000)
  radius?: number;

  @ApiPropertyOptional({ enum: GreenCoverageType })
  @IsOptional()
  @IsEnum(GreenCoverageType)
  type?: GreenCoverageType;
}
