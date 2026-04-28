import { IsLatitude, IsLongitude, IsString, IsEnum } from 'class-validator';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RadarQueryDto {
  @ApiProperty({ description: 'User\'s current latitude', example: 10.987 })
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: 'User\'s current longitude', example: -74.789 })
  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @ApiProperty({ description: 'Type of vehicle', enum: VehicleType, example: VehicleType.MOTO })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ description: 'Vehicle\'s plate number', example: 'ABC-123' })
  @IsString()
  plate: string;
}
