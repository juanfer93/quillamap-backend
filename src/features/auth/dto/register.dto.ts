import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, ValidateIf, IsEmail } from 'class-validator';
import { MobilityMode } from '@/features/profiles/entities/mobility_mode.enum';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  full_name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ enum: MobilityMode })
  @IsEnum(MobilityMode)
  mobility_mode: MobilityMode;

  @ApiProperty({ enum: VehicleType, nullable: true })
  @IsEnum(VehicleType)
  @ValidateIf((o) => o.mobility_mode === MobilityMode.CARRO)
  vehicle_type?: VehicleType;

  @ApiProperty({ nullable: true })
  @IsString()
  @ValidateIf((o) => o.mobility_mode === MobilityMode.MOTO || o.mobility_mode === MobilityMode.CARRO)
  license_plate?: string;
}
