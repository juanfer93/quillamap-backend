import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum NavigationMode {
  PEATON = 'peaton',
  TURISTA = 'turista',
  MOTO = 'moto',
  CARRO = 'carro',
}

export class RouteWaypointDto {
  @ApiProperty({ example: 10.9878 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -74.7889 })
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 'Ventana al Mundo' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class RoutePreferencesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  prioritizeShade?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  prioritizeCulturalLandmarks?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  avoidLegalRestrictions?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  avoidActiveStreams?: boolean;
}

export class RouteRequestDto {
  @ApiProperty({ type: RouteWaypointDto })
  @ValidateNested()
  @Type(() => RouteWaypointDto)
  origin: RouteWaypointDto;

  @ApiProperty({ type: RouteWaypointDto })
  @ValidateNested()
  @Type(() => RouteWaypointDto)
  destination: RouteWaypointDto;

  @ApiProperty({ enum: NavigationMode, example: NavigationMode.CARRO })
  @IsEnum(NavigationMode)
  mode: NavigationMode;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @ApiPropertyOptional({ type: RoutePreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePreferencesDto)
  preferences?: RoutePreferencesDto;
}
