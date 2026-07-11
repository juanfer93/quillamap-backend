import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from '@/features/zones/enums/restriction-type.enum';
import { Zone } from '@/features/zones/entities/zone.entity';
import { ZonesService } from '@/features/zones/zones.service';
import { NavigationMode, RouteRequestDto } from '@/features/navigation/dto/route-request.dto';
import { NavigationService } from '@/features/navigation/navigation.service';

const mockFetch = jest.fn<Promise<Response>, [string, RequestInit?]>();

global.fetch = mockFetch as unknown as typeof fetch;

const routeRequest: RouteRequestDto = {
  origin: { latitude: 10.9878, longitude: -74.7889 },
  destination: { latitude: 11.019, longitude: -74.8213 },
  mode: NavigationMode.CARRO,
  licensePlate: 'ABC123',
  preferences: { avoidActiveStreams: true, avoidLegalRestrictions: true },
};

const zone = {
  id: 'zone-1',
  name: 'Soledad',
  active: true,
  boundary: { type: 'Polygon', coordinates: [] },
  rules: { metadata: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
} as Zone;

const osrmPayload = {
  code: 'Ok',
  routes: [
    {
      distance: 1200,
      duration: 300,
      geometry: {
        type: 'LineString',
        coordinates: [[-74.7889, 10.9878], [-74.79, 10.99]],
      },
    },
    {
      distance: 1500,
      duration: 360,
      geometry: {
        type: 'LineString',
        coordinates: [[-74.7889, 10.9878], [-74.8213, 11.019]],
      },
    },
  ],
};

describe('NavigationService', () => {
  let service: NavigationService;
  const zoneRepository = { query: jest.fn() };
  const reportRepository = { query: jest.fn() };
  const zonesService = { isRestricted: jest.fn() };
  const configService = {
    get: jest.fn((key: string) => ({
      OSRM_BASE_URL: 'http://osrm.local',
      OSRM_DRIVING_BASE_URL: 'http://osrm-car.local',
      OSRM_WALKING_BASE_URL: 'http://osrm-foot.local',
    })[key]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavigationService,
        { provide: ConfigService, useValue: configService },
        { provide: ZonesService, useValue: zonesService },
        { provide: getRepositoryToken(Zone), useValue: zoneRepository },
        { provide: getRepositoryToken(Report), useValue: reportRepository },
      ],
    }).compile();

    service = module.get<NavigationService>(NavigationService);
    mockFetch.mockReset();
    zoneRepository.query.mockReset();
    reportRepository.query.mockReset();
    zonesService.isRestricted.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => osrmPayload,
    } as Response);
    reportRepository.query.mockResolvedValue([]);
  });

  it('elige una alternativa cuando la ruta principal viola una restriccion legal', async () => {
    zoneRepository.query.mockResolvedValueOnce([zone]).mockResolvedValueOnce([]);
    zonesService.isRestricted.mockResolvedValue({
      restricted: true,
      reason: RestrictionType.PICO_Y_PLACA,
    });

    const result = await service.calculateRoute(routeRequest);

    expect(result.legalStatus).toBe('rerouted');
    expect(result.geometry).toEqual([
      { latitude: 10.9878, longitude: -74.7889 },
      { latitude: 11.019, longitude: -74.8213 },
    ]);
    expect(zoneRepository.query.mock.calls[0][0]).toContain('ST_Intersects');
    expect(mockFetch.mock.calls[0][0]).toContain('http://osrm-car.local');
    expect(mockFetch.mock.calls[0][0]).toContain('/route/v1/driving/');
  });

  it('usa el OSRM peatonal dedicado para modo peaton', async () => {
    zoneRepository.query.mockResolvedValue([]);

    await service.calculateRoute({
      ...routeRequest,
      mode: NavigationMode.PEATON,
    });

    expect(mockFetch.mock.calls[0][0]).toContain('http://osrm-foot.local');
    expect(mockFetch.mock.calls[0][0]).toContain('/route/v1/walking/');
  });

  it('devuelve la mejor ruta legal con alertas cuando no hay alternativa sin riesgo', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [osrmPayload.routes[0]] }),
    } as Response);
    zoneRepository.query.mockResolvedValue([]);
    reportRepository.query
      .mockResolvedValueOnce([{ id: 'arroyo-1', description: 'Arroyo activo' }])
      .mockResolvedValueOnce([]);

    const result = await service.calculateRoute(routeRequest);

    expect(result.legalStatus).toBe('allowed');
    expect(result.alerts).toEqual([
      expect.objectContaining({
        id: 'arroyo-1',
        type: 'arroyo_activo',
        severity: 'danger',
      }),
    ]);
  });

  it('devuelve ruta con alerta si falla la validacion espacial auxiliar', async () => {
    zoneRepository.query.mockRejectedValue(new Error('postgis unavailable'));

    const result = await service.calculateRoute(routeRequest);

    expect(result.legalStatus).toBe('allowed');
    expect(result.alerts).toEqual([
      expect.objectContaining({
        id: 'risk-validation-unavailable',
        type: 'zona_restringida',
        severity: 'warning',
      }),
    ]);
  });

  it('rechaza rutas que violan pico y placa por placa del perfil', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [osrmPayload.routes[0]] }),
    } as Response);
    zoneRepository.query.mockResolvedValue([zone]);
    zonesService.isRestricted.mockResolvedValue({
      restricted: true,
      reason: RestrictionType.PICO_Y_PLACA,
    });

    await expect(service.calculateRoute({
      ...routeRequest,
      mode: NavigationMode.MOTO,
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(zonesService.isRestricted).toHaveBeenCalledWith(zone.id, {
      type: VehicleType.MOTO,
      plate: routeRequest.licensePlate,
      dateTime: expect.any(Date),
    });
  });
});
