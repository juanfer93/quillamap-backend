import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum TransitCommunityRouteStatus {
  VIGENTE = 'vigente',
  DESVIADO = 'desviado',
  SUSPENDIDO = 'suspendido',
}

export class TransitCommunityValidationDto {
  @ApiProperty({ example: 'A1-2' })
  @IsString()
  routeId: string;

  @ApiPropertyOptional({ example: 'stop-joe-arroyo' })
  @IsOptional()
  @IsString()
  stopId?: string;

  @ApiProperty({ example: 10.9878 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -74.7889 })
  @IsLongitude()
  longitude: number;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracyMeters: number;

  @ApiProperty({ example: '2026-07-22T16:30:00.000Z' })
  @IsDateString()
  observedAtIso: string;

  @ApiProperty({ enum: TransitCommunityRouteStatus, example: TransitCommunityRouteStatus.VIGENTE })
  @IsEnum(TransitCommunityRouteStatus)
  status: TransitCommunityRouteStatus;

  @ApiPropertyOptional({ example: 'La ruta sigue pasando por este paradero.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export interface TransitCommunityValidationResult {
  accepted: boolean;
  reason?: string;
  serverDistanceMeters?: number;
}
