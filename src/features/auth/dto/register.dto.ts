import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, ValidateIf, IsEmail } from 'class-validator';
import { VehicleType } from './enums/vehicle-type.enum';
import { CarType } from './enums/car-type.enum';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ enum: CarType, nullable: true })
  @IsEnum(CarType)
  @ValidateIf((o) => o.vehicleType === VehicleType.CARRO)
  carType?: CarType;

  @ApiProperty({ nullable: true })
  @IsString()
  @ValidateIf((o) => o.vehicleType === VehicleType.MOTO || o.vehicleType === VehicleType.CARRO)
  plate?: string;
}
