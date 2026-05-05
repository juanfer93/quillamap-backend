import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { MobilityMode } from '../entities/mobility_mode.enum';
import { VehicleType } from '../entities/vehicle_type.enum';

export class CreateProfileDto {
  @ApiProperty({ enum: MobilityMode })
  @IsEnum(MobilityMode)
  mobility_mode: MobilityMode;

  @ApiProperty({ enum: VehicleType, nullable: true })
  @IsOptional()
  @IsEnum(VehicleType)
  @ValidateIf((o) => o.mobility_mode !== MobilityMode.PEDESTRIAN && o.mobility_mode !== MobilityMode.TOURIST)
  vehicle_type?: VehicleType;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.mobility_mode !== MobilityMode.PEDESTRIAN && o.mobility_mode !== MobilityMode.TOURIST)
  license_plate?: string;
}
