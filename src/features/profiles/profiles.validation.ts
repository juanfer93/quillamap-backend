
import { z } from 'zod';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';

export const profileSchema = z.object({
  full_name: z.string().min(2).max(255),
  vehicle_type: z.nativeEnum(VehicleType),
  plate_number: z.string().length(6).optional(),
  is_vehicle_owner: z.boolean().default(false),
});
