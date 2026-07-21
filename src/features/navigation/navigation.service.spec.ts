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
  let configValues: Record<string, string | undefined>;
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    configValues = {
      OSRM_BASE_URL: 'http://osrm.local',
      OSRM_DRIVING_BASE_URL: 'http://osrm-car.local',
      OSRM_WALKING_BASE_URL: 'http://osrm-foot.local',
    };
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
    expect(mockFetch.mock.calls[0][0]).toContain('steps=true');
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

  it('usa TomTom con trafico real para modos vehiculares cuando hay API key', async () => {
    configValues.TOMTOM_API_KEY = 'tomtom-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            summary: {
              lengthInMeters: 3237,
              travelTimeInSeconds: 420,
            },
            legs: [
              {
                points: [
                  { latitude: 10.9878, longitude: -74.7889 },
                  { latitude: 11.019, longitude: -74.8213 },
                ],
              },
            ],
            guidance: {
              instructions: [
                {
                  routeOffsetInMeters: 0,
                  travelTimeInSeconds: 0,
                  street: 'Calle 79',
                  message: 'Toma Calle 79',
                  point: { latitude: 10.9878, longitude: -74.7889 },
                },
              ],
            },
          },
          {
            summary: {
              lengthInMeters: 3500,
              travelTimeInSeconds: 520,
            },
            legs: [
              {
                points: [
                  { latitude: 10.9878, longitude: -74.7889 },
                  { latitude: 11.01, longitude: -74.81 },
                  { latitude: 11.019, longitude: -74.8213 },
                ],
              },
            ],
          },
        ],
      }),
    } as Response);
    zoneRepository.query.mockResolvedValue([]);

    const result = await service.calculateRoute(routeRequest);

    expect(result.provider).toBe('tomtom');
    expect(result.distanceMeters).toBe(3237);
    expect(result.durationSeconds).toBe(420);
    expect(result.geometry).toEqual([
      { latitude: 10.9878, longitude: -74.7889 },
      { latitude: 11.019, longitude: -74.8213 },
    ]);
    expect(result.selectedRouteIndex).toBe(0);
    expect(result.alternatives).toEqual([
      expect.objectContaining({ index: 0, distanceMeters: 3237, durationSeconds: 420, provider: 'tomtom' }),
      expect.objectContaining({ index: 1, distanceMeters: 3500, durationSeconds: 520, provider: 'tomtom' }),
    ]);
    expect(result.instructions).toEqual([
      expect.objectContaining({
        index: 1,
        message: 'Toma Calle 79',
        street: 'Calle 79',
      }),
    ]);
    expect(mockFetch.mock.calls[0][0]).toContain('https://api.tomtom.com/routing/1/calculateRoute/');
    expect(mockFetch.mock.calls[0][0]).toContain('traffic=true');
    expect(mockFetch.mock.calls[0][0]).toContain('travelMode=car');
    expect(mockFetch.mock.calls[0][0]).toContain('key=tomtom-key');
    expect(mockFetch.mock.calls[0][0]).toContain('instructionsType=text');
  });

  it('mantiene OSRM para peatones aunque exista API key de TomTom', async () => {
    configValues.TOMTOM_API_KEY = 'tomtom-key';
    zoneRepository.query.mockResolvedValue([]);

    await service.calculateRoute({
      ...routeRequest,
      mode: NavigationMode.PEATON,
    });

    expect(mockFetch.mock.calls[0][0]).toContain('http://osrm-foot.local');
    expect(mockFetch.mock.calls[0][0]).toContain('/route/v1/walking/');
  });

  it('mantiene OSRM para peatones aunque se fuerce TomTom como proveedor', async () => {
    configValues.TOMTOM_API_KEY = 'tomtom-key';
    configValues.ROUTING_ENGINE_PROVIDER = 'tomtom';
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
