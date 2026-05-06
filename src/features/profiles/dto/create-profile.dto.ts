import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { MobilityMode } from '@/features/profiles/entities/mobility_mode.enum';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';

export class CreateProfileDto {
  @ApiProperty({ enum: MobilityMode })
  @IsEnum(MobilityMode)
  mobility_mode: MobilityMode;

  @ApiProperty({ enum: VehicleType, nullable: true })
  @IsOptional()
  @IsEnum(VehicleType)
  @ValidateIf((o) => o.mobility_mode !== MobilityMode.PEATON && o.mobility_mode !== MobilityMode.TURISTA)
  vehicle_type?: VehicleType;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.mobility_mode !== MobilityMode.PEATON && o.mobility_mode !== MobilityMode.TURISTA)
  license_plate?: string;
}
