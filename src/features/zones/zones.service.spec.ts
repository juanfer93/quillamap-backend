import { Test, TestingModule } from '@nestjs/testing';
import { ZonesService } from './zones.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Zone } from './entities/zone.entity';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from './enums/restriction-type.enum';
import { DayOfWeek } from './interfaces/zone-rules.interface';
import { Polygon } from 'geojson';

describe('ZonesService - Restriction Logic', () => {
  let service: ZonesService;

  const mockBoundary: Polygon = {
    type: 'Polygon',
    coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
  };

  const mockZone: Zone = {
    id: 'zone-123',
    name: 'Soledad - Motos',
    active: true,
    boundary: mockBoundary, // Ya no es null
    rules: {
      metadata: [ // Estructura correcta que coincide con ZoneRulesMetadata
        {
          type: RestrictionType.PICO_Y_PLACA,
          vehicleType: VehicleType.MOTO,
          startTime: '05:00',
          endTime: '22:00',
          days: [DayOfWeek.MONDAY],
          plateCondition: { allPlates: false, lastDigits: [1, 3] }
        }
      ]
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonesService,
        {
          provide: getRepositoryToken(Zone),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockZone),
          },
        },
      ],
    }).compile();

    service = module.get<ZonesService>(ZonesService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe restringir una moto con placa terminada en 1 un lunes en Soledad', async () => {
    // '2026-04-27' es Lunes
    const mondayMorning = new Date('2026-04-27T10:00:00'); 
    const result = await service.isRestricted('zone-123', {
      type: VehicleType.MOTO,
      plate: 'ABC-121',
      dateTime: mondayMorning
    });

    expect(result.restricted).toBe(true);
    expect(result.reason).toBe(RestrictionType.PICO_Y_PLACA);
  });
});