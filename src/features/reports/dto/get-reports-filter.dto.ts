import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class GetReportsFilterDto {
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  radius?: number;
}
