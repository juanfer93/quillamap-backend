import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetReportsFilterDto {
  @ApiProperty({ description: "User's current latitude", example: 10.987 }) 
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: "User's current longitude", example: -74.789 }) 
  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @ApiProperty({ description: 'Radius in meters to search for reports', example: 2000, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(300)
  @Max(5000)
  radius?: number;
}
