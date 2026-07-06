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
import { ApiProperty } from '@nestjs/swagger';
import { PlaceCategory } from '../entities/place-category.enum';

export class GetPlacesFilterDto {
  @ApiProperty({ description: "User's current latitude", example: 10.987 })
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: "User's current longitude", example: -74.789 })
  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @ApiProperty({ description: 'Radius in meters to search for places', example: 5000, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(300)
  @Max(10000)
  radius?: number;

  @ApiProperty({ description: 'Optional Waze-compatible category filter', enum: PlaceCategory, required: false })
  @IsEnum(PlaceCategory)
  @IsOptional()
  category?: PlaceCategory;
}
