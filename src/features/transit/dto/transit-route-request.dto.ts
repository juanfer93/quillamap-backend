import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum TransitMode {
  PEATON = 'peaton',
  TURISTA = 'turista',
}

export enum TransitAgencyKind {
  TRANSMETRO = 'transmetro',
  COLECTIVO = 'colectivo',
}

export class TransitWaypointDto {
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

export class TransitPreferencesDto {
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
  avoidActiveStreams?: boolean;

  @ApiPropertyOptional({ enum: TransitAgencyKind, example: TransitAgencyKind.TRANSMETRO })
  @IsOptional()
  @IsEnum(TransitAgencyKind)
  preferredAgencyKind?: TransitAgencyKind;
}

export class TransitRouteRequestDto {
  @ApiProperty({ type: TransitWaypointDto })
  @ValidateNested()
  @Type(() => TransitWaypointDto)
  origin: TransitWaypointDto;

  @ApiProperty({ type: TransitWaypointDto })
  @ValidateNested()
  @Type(() => TransitWaypointDto)
  destination: TransitWaypointDto;

  @ApiProperty({ enum: TransitMode, example: TransitMode.PEATON })
  @IsEnum(TransitMode)
  mode: TransitMode;

  @ApiPropertyOptional({ example: '2026-07-22T16:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  departureIso?: string;

  @ApiPropertyOptional({ type: TransitPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransitPreferencesDto)
  preferences?: TransitPreferencesDto;
}
