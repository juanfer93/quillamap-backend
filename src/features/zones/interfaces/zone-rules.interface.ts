import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from '../enums/restriction-type.enum';

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export interface ZoneRule {
  type: RestrictionType;
  vehicleType: VehicleType;
  startTime: string; // formato "HH:mm"
  endTime: string;   // formato "HH:mm"
  days: DayOfWeek[];
  plateCondition: {
    allPlates: boolean;
    lastDigits?: number[];
  };
}

export interface ZoneRulesMetadata {
  metadata: ZoneRule[]; 
}