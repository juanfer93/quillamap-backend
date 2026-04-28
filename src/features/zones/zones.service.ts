import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from '@/features/zones/entities/zone.entity';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from '@/features/zones/enums/restriction-type.enum';
import { DayOfWeek } from '@/features/zones/interfaces/zone-rules.interface';
import { RadarQueryDto } from '@/features/zones/dto/radar-query.dto';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
  ) {}

  async create(createZoneDto: Partial<Zone>): Promise<Zone> {
    const zone = this.zoneRepository.create(createZoneDto);
    return await this.zoneRepository.save(zone);
  }

  async findAllActive(): Promise<Zone[]> {
    return await this.zoneRepository.find({ where: { active: true } });
  }

  async findOne(id: string): Promise<Zone> {
    const zone = await this.zoneRepository.findOne({ where: { id } });
    if (!zone) throw new NotFoundException(`Zone with ID ${id} not found`);
    return zone;
  }

  async getNearbyRestrictions(dto: RadarQueryDto): Promise<Zone[]> {
    const { lat, lng, vehicleType, plate } = dto;

    const nearbyZones = await this.zoneRepository.query(
      `
      SELECT * FROM zones
      WHERE "active" = true AND ST_DWithin(boundary::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 500);
      `,
      [lng, lat],
    );

    const restrictedZones: Zone[] = [];

    for (const zone of nearbyZones) {
      const { restricted } = await this.isRestricted(zone.id, {
        type: vehicleType,
        plate,
        dateTime: new Date(),
      });

      if (restricted) {
        restrictedZones.push(zone);
      }
    }

    return restrictedZones;
  }

  async isRestricted(
    zoneId: string, 
    vehicleData: { type: VehicleType; plate: string; dateTime: Date }
  ): Promise<{ restricted: boolean; reason: RestrictionType | null }> {
    const zone = await this.findOne(zoneId);
    const { type, plate, dateTime } = vehicleData;

    const daysMap: DayOfWeek[] = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
    ];
    const currentDay = daysMap[dateTime.getDay()];
    const currentTimeStr = `${dateTime.getHours().toString().padStart(2, '0')}:${dateTime.getMinutes().toString().padStart(2, '0')}`;

    const lastDigit = parseInt(plate.slice(-1));

    for (const rule of zone.rules.metadata) {
      if (rule.vehicleType === type && rule.days.includes(currentDay)) {
        
        if (currentTimeStr >= rule.startTime && currentTimeStr <= rule.endTime) {
          
          if (rule.plateCondition.allPlates) {
            return { restricted: true, reason: rule.type };
          }

          if (rule.plateCondition.lastDigits?.includes(lastDigit)) {
            return { restricted: true, reason: rule.type };
          }
        }
      }
    }

    return { restricted: false, reason: null };
  }
}
