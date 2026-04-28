import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from '../enums/restriction-type.enum';

export enum DayOfWeek {
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
  SUNDAY,
}

export interface PlateCondition {
  all: boolean;
  lastDigits?: number[];
}

export interface ZoneRule {
  type: RestrictionType;
  vehicleType: VehicleType[];
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  days: DayOfWeek[];
  plateCondition?: PlateCondition;
}

export interface ZoneRulesMetadata {
  rules: ZoneRule[];
}
