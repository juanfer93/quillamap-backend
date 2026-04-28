import { IsLatitude, IsLongitude, IsString, IsEnum } from 'class-validator';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';

export class RadarQueryDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString()
  plate: string;
}
