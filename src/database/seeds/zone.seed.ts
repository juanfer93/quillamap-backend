
import { DataSource } from 'typeorm';
import { Zone } from '@/features/zones/entities/zone.entity';
import { RestrictionType } from '@/features/zones/enums/restriction-type.enum';
import { DayOfWeek } from '@/features/zones/interfaces/zone-rules.interface';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { Polygon } from 'geojson';

export const seedZones = async (dataSource: DataSource): Promise<void> => {
  const zoneRepository = dataSource.getRepository(Zone);

  const zones = [
    {
      name: 'Cuadrante Norte (Bquilla)',
      rules: {
        metadata: [
          {
            type: RestrictionType.ZONA_PROHIBIDA,
            vehicleType: VehicleType.MOTO,
            startTime: '00:00',
            endTime: '23:59',
            days: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
            plateCondition: { allPlates: true },
          },
        ],
      },
      boundary: {
        type: 'Polygon',
        coordinates: [
          [[-74.81, 11.01], [-74.77, 11.01], [-74.77, 10.97], [-74.81, 10.97], [-74.81, 11.01]]
        ],
      } as Polygon,
    },
    {
      name: 'Soledad',
      rules: {
        metadata: [
          {
            type: RestrictionType.ZONA_PROHIBIDA,
            vehicleType: VehicleType.MOTO,
            startTime: '00:00',
            endTime: '23:59',
            days: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
            plateCondition: { allPlates: true },
          },
        ],
      },
      boundary: {
        type: 'Polygon',
        coordinates: [
          [[-74.77, 10.93], [-74.74, 10.93], [-74.74, 10.89], [-74.77, 10.89], [-74.77, 10.93]]
        ],
      } as Polygon,
    },
    {
      name: 'Centro (Parrillero)',
      rules: {
        metadata: [
          {
            type: RestrictionType.PARRILLERO_HOMBRE,
            vehicleType: VehicleType.MOTO,
            startTime: '00:00',
            endTime: '23:59',
            days: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
            plateCondition: { allPlates: true },
          },
        ],
      },
      boundary: {
        type: 'Polygon',
        coordinates: [
          [[-74.79, 10.98], [-74.77, 10.98], [-74.77, 10.96], [-74.79, 10.96], [-74.79, 10.98]]
        ],
      } as Polygon,
    },
  ];

  for (const zoneData of zones) {
    const existingZone = await zoneRepository.findOne({ where: { name: zoneData.name } });

    if (!existingZone) {
      const newZone = new Zone();
      newZone.name = zoneData.name;
      newZone.rules = zoneData.rules;
      newZone.boundary = zoneData.boundary;
      await zoneRepository.save(newZone);
      console.log(`Zone "${zoneData.name}" seeded.`);
    } else {
      console.log(`Zone "${zoneData.name}" already exists.`);
    }
  }
};
