import { Test, TestingModule } from '@nestjs/testing';
import { ZonesService } from '@/features/zones/zones.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Zone } from '@/features/zones/entities/zone.entity';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from '@/features/zones/enums/restriction-type.enum';
import { DayOfWeek } from '@/features/zones/interfaces/zone-rules.interface';
import { Polygon } from 'geojson';
import { RadarQueryDto } from '@/features/zones/dto/radar-query.dto';

describe('ZonesService', () => {
  let service: ZonesService;

  const mockBoundary: Polygon = {
    type: 'Polygon',
    coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
  };

  const mockZone: Zone = {
    id: 'zone-123',
    name: 'Soledad - Motos',
    active: true,
    boundary: mockBoundary,
    rules: {
      metadata: [
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

  const mockZoneRepository = {
    findOne: jest.fn().mockResolvedValue(mockZone),
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonesService,
        {
          provide: getRepositoryToken(Zone),
          useValue: mockZoneRepository,
        },
      ],
    }).compile();

    service = module.get<ZonesService>(ZonesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isRestricted', () => {
    it('should restrict a motorcycle with plate ending in 1 on a Monday in Soledad', async () => {
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

  describe('getNearbyRestrictions', () => {
    const radarQuery: RadarQueryDto = {
      lat: 10.987,
      lng: -74.789,
      vehicleType: VehicleType.MOTO,
      plate: 'ABC-121',
    };

    it('should return a restricted zone when a nearby zone is found and the vehicle is restricted', async () => {
      mockZoneRepository.query.mockResolvedValue([mockZone]);
      const isRestrictedSpy = jest.spyOn(service, 'isRestricted').mockResolvedValue({ restricted: true, reason: RestrictionType.PICO_Y_PLACA });

      const result = await service.getNearbyRestrictions(radarQuery);

      expect(result).toEqual([mockZone]);
      expect(mockZoneRepository.query).toHaveBeenCalled();
      expect(isRestrictedSpy).toHaveBeenCalledWith(mockZone.id, {
        type: radarQuery.vehicleType,
        plate: radarQuery.plate,
        dateTime: expect.any(Date),
      });
    });

    it('should return an empty array when a nearby zone is found but the vehicle is not restricted', async () => {
      mockZoneRepository.query.mockResolvedValue([mockZone]);
      const isRestrictedSpy = jest.spyOn(service, 'isRestricted').mockResolvedValue({ restricted: false, reason: null });

      const result = await service.getNearbyRestrictions({ ...radarQuery, vehicleType: VehicleType.PEATON });

      expect(result).toEqual([]);
      expect(mockZoneRepository.query).toHaveBeenCalled();
      expect(isRestrictedSpy).toHaveBeenCalled();
    });

    it('should return an empty array when no nearby zones are found', async () => {
      mockZoneRepository.query.mockResolvedValue([]);
      const isRestrictedSpy = jest.spyOn(service, 'isRestricted');

      const result = await service.getNearbyRestrictions(radarQuery);

      expect(result).toEqual([]);
      expect(mockZoneRepository.query).toHaveBeenCalled();
      expect(isRestrictedSpy).not.toHaveBeenCalled();
    });
  });
});
