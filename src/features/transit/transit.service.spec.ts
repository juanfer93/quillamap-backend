import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { TransitMode } from '@/features/transit/dto/transit-route-request.dto';
import { TransitService } from '@/features/transit/transit.service';

const otpPayload = {
  plan: {
    itineraries: [
      {
        duration: 900,
        legs: [
          {
            mode: 'WALK',
            distance: 300,
            duration: 240,
            from: { name: 'Origen', lat: 10.9878, lon: -74.7889 },
            to: { name: 'Paradero', lat: 10.99, lon: -74.79, stopId: 'stop-a' },
            legGeometry: { points: '' },
          },
          {
            mode: 'BUS',
            route: 'A1-2',
            routeId: 'A1-2',
            agencyName: 'Transmetro',
            headsign: 'Portal',
            distance: 2200,
            duration: 660,
            from: { name: 'Paradero', lat: 10.99, lon: -74.79, stopId: 'stop-a' },
            to: { name: 'Destino', lat: 11.019, lon: -74.8213, stopId: 'stop-b' },
            legGeometry: { points: '' },
          },
        ],
      },
    ],
  },
};

describe('TransitService', () => {
  const query = jest.fn();
  const dataSourceQuery = jest.fn();
  const fetchMock = jest.fn();
  let service: TransitService;

  beforeEach(async () => {
    query.mockReset();
    dataSourceQuery.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => otpPayload,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransitService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OTP_PLAN_BASE_URL') return 'http://localhost:8080/otp/routers/default/plan';
              if (key === 'TRANSIT_SOURCE_VERSION') return 'test-gtfs';
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(Report),
          useValue: { query },
        },
        {
          provide: DataSource,
          useValue: { query: dataSourceQuery },
        },
      ],
    }).compile();

    service = moduleRef.get(TransitService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calcula itinerarios peatonales via OTP y cruza riesgos', async () => {
    query.mockResolvedValue([]);

    const response = await service.calculateItineraries({
      origin: { latitude: 10.9878, longitude: -74.7889 },
      destination: { latitude: 11.019, longitude: -74.8213 },
      mode: TransitMode.PEATON,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('mode=TRANSIT%2CWALK'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ST_DWithin'), expect.any(Array));
    expect(response.itineraries[0]).toMatchObject({
      mode: 'peaton',
      riskStatus: 'clear',
      transfers: 0,
      sourceVersion: 'test-gtfs',
    });
  });

  it('selecciona alternativa sin riesgo si la primera cruza arroyo activo', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          itineraries: [
            otpPayload.plan.itineraries[0],
            { ...otpPayload.plan.itineraries[0], duration: 960 },
          ],
        },
      }),
    });
    query
      .mockResolvedValueOnce([{ id: 'arroyo-1', description: 'Arroyo activo' }])
      .mockResolvedValue([]);

    const response = await service.calculateItineraries({
      origin: { latitude: 10.9878, longitude: -74.7889 },
      destination: { latitude: 11.019, longitude: -74.8213 },
      mode: TransitMode.TURISTA,
    });

    expect(response.itineraries[0].riskStatus).toBe('rerouted');
    expect(response.itineraries[0].recalculatedForRisk).toBe(true);
  });

  it('rechaza validacion comunitaria lejos de ruta o paradero', async () => {
    query.mockResolvedValue([]);

    await expect(service.validateRoutePresence({
      routeId: 'A1-2',
      latitude: 10,
      longitude: -74,
      accuracyMeters: 12,
      observedAtIso: new Date().toISOString(),
      status: 'vigente' as never,
    })).resolves.toMatchObject({ accepted: false });
  });

  it('devuelve rutas y paraderos como GeoJSON para MapLibre', async () => {
    dataSourceQuery
      .mockResolvedValueOnce([
        {
          id: 'osm-shape-1',
          route_id: 'osm-relation-1',
          short_name: 'B1',
          long_name: 'Portal de Barranquillita',
          agency_kind: 'transmetro',
          source_kind: 'osm_overpass',
          operator_name: 'Transmetro',
          geometry: {
            type: 'LineString',
            coordinates: [[-74.79, 10.99], [-74.8, 11], [-74.81, 11.01]],
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'osm-stop-node-1',
          route_id: 'osm-community',
          name: 'Paradero OSM',
          agency_kind: 'colectivo',
          source_kind: 'osm_overpass',
          geometry: {
            type: 'Point',
            coordinates: [-74.79, 10.99],
          },
        },
      ]);

    const response = await service.getTransitMap();

    expect(dataSourceQuery).toHaveBeenCalledTimes(2);
    expect(response.features).toHaveLength(2);
    expect(response.features[0]).toMatchObject({
      type: 'Feature',
      properties: {
        kind: 'route',
        shortName: 'B1',
        color: '#004574',
      },
    });
    expect(response.features[1]).toMatchObject({
      properties: {
        kind: 'stop',
        color: '#0077A3',
      },
    });
  });

  it('no expone rutas con geometria incompleta de dos puntos', async () => {
    dataSourceQuery
      .mockResolvedValueOnce([
        {
          id: 'osm-shape-incompleta',
          route_id: 'osm-relation-incompleta',
          short_name: 'D13B',
          long_name: 'American Bar Normandia',
          agency_kind: 'colectivo',
          source_kind: 'osm_overpass',
          operator_name: 'Transoledad',
          geometry: {
            type: 'LineString',
            coordinates: [[-74.7751575, 10.9180045], [-74.7751299, 10.9179298]],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await service.getTransitMap();

    expect(response.features).toHaveLength(0);
  });

  it('marca rutas transmetro especiales segun su condicion operativa', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-28T12:00:00-05:00'));
    dataSourceQuery
      .mockResolvedValueOnce([
        {
          id: 'transmetro-secondary-ruta-navidena',
          route_id: 'transmetro-ruta-navidena',
          short_name: 'RUTA-NAVIDENA',
          long_name: 'Ruta Navidena',
          agency_kind: 'transmetro',
          source_kind: 'official_web',
          operator_name: 'Transmetro',
          route_metadata: {
            operatingCondition: 'christmas_season',
            operatingConditionLabel: 'Solo opera en temporada navidena.',
            seasonalWindow: {
              startsOn: '11-15',
              endsOn: '01-15',
            },
          },
          geometry: {
            type: 'LineString',
            coordinates: [[-74.79, 10.99], [-74.8, 11], [-74.81, 11.01]],
          },
        },
        {
          id: 'transmetro-secondary-ruta-chevere',
          route_id: 'transmetro-ruta-chevere',
          short_name: 'RUTA-CHEVERE',
          long_name: 'Ruta Chevere',
          agency_kind: 'transmetro',
          source_kind: 'official_web',
          operator_name: 'Transmetro',
          route_metadata: {
            operatingCondition: 'weekends',
            operatingConditionLabel: 'Solo opera los fines de semana.',
          },
          geometry: {
            type: 'LineString',
            coordinates: [[-74.79, 10.99], [-74.8, 11], [-74.81, 11.01]],
          },
        },
        {
          id: 'transmetro-a4-1-manual-shape',
          route_id: 'transmetro-a4-1',
          short_name: 'A4-1',
          long_name: 'Malambo',
          agency_kind: 'transmetro',
          source_kind: 'official_web',
          operator_name: 'Transmetro',
          route_metadata: {
            operatingCondition: 'temporarily_suspended',
            operatingConditionLabel: 'Temporalmente parada.',
            isCurrentlyOperatingOverride: false,
          },
          geometry: {
            type: 'LineString',
            coordinates: [[-74.79, 10.99], [-74.8, 11], [-74.81, 11.01]],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await service.getTransitMap();

    expect(response.features).toEqual([
      expect.objectContaining({
        properties: expect.objectContaining({
          shortName: 'RUTA-NAVIDENA',
          operatingCondition: 'christmas_season',
          isCurrentlyOperating: false,
        }),
      }),
      expect.objectContaining({
        properties: expect.objectContaining({
          shortName: 'RUTA-CHEVERE',
          operatingCondition: 'weekends',
          isCurrentlyOperating: false,
        }),
      }),
      expect.objectContaining({
        properties: expect.objectContaining({
          shortName: 'A4-1',
          operatingCondition: 'temporarily_suspended',
          isCurrentlyOperating: false,
        }),
      }),
    ]);
  });

  it('consulta por HTTP la secuencia de calles de una ruta cuando la metadata la trae', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        route_id: 'osm-relation-6017021',
        short_name: 'A1-2',
        long_name: 'Carrera Ocho',
        agency_kind: 'transmetro',
        route_source_kind: 'osm_overpass',
        operator_name: 'Transmetro',
        route_metadata: null,
        shape_id: 'osm-shape-6017021',
        shape_source_kind: 'osm_overpass',
        shape_metadata: {
          geometryStatus: 'osm_relation_member_ways',
          streets: ['Carrera 8', 'Calle 51B', 'Carrera 8'],
        },
        coordinates_count: 320,
      },
    ]);

    const response = await service.getTransitRouteStreets('A1-2');

    expect(dataSourceQuery).toHaveBeenCalledWith(expect.stringContaining('lower(r.short_name) = lower($1)'), ['A1-2']);
    expect(response).toMatchObject({
      route: {
        id: 'osm-relation-6017021',
        shortName: 'A1-2',
        isCurrentlyOperating: true,
      },
      streets: ['Carrera 8', 'Calle 51B'],
      directions: [
        {
          shapeId: 'osm-shape-6017021',
          streets: ['Carrera 8', 'Calle 51B'],
          coordinatesCount: 320,
        },
      ],
      coverage: {
        hasGeometry: true,
        hasStreetSequence: true,
        directionSplit: 'not_available',
      },
    });
  });

  it('explica cuando una ruta existe en catalogo pero no tiene geometria ni calles', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        route_id: 'transmetro-a4-1',
        short_name: 'A4-1',
        long_name: 'Malambo',
        agency_kind: 'transmetro',
        route_source_kind: 'official_web',
        operator_name: 'Transmetro',
        route_metadata: {
          operatingCondition: 'temporarily_suspended',
          operatingConditionLabel: 'Temporalmente parada.',
          isCurrentlyOperatingOverride: false,
        },
        shape_id: null,
        shape_source_kind: null,
        shape_metadata: null,
        coordinates_count: null,
      },
    ]);

    const response = await service.getTransitRouteStreets('A4-1');

    expect(response).toMatchObject({
      route: {
        id: 'transmetro-a4-1',
        shortName: 'A4-1',
        operatingCondition: 'temporarily_suspended',
        isCurrentlyOperating: false,
      },
      streets: [],
      directions: [],
      coverage: {
        hasGeometry: false,
        hasStreetSequence: false,
        directionSplit: 'not_available',
      },
    });
    expect(response.coverage.note).toContain('no tiene geometria');
  });

  it('sugiere las cuatro mejores opciones directas de bus entre dos coordenadas', async () => {
    const makeSuggestionRow = (
      shortName: string,
      originWalkMeters: number,
      destinationWalkMeters: number,
      busDistanceMeters: number,
    ) => ({
      route_id: `route-${shortName.toLowerCase()}`,
      short_name: shortName,
      long_name: `Ruta ${shortName}`,
      agency_kind: 'colectivo',
      route_source_kind: 'official_web',
      operator_name: 'Operador',
      route_metadata: null,
      shape_id: `shape-${shortName.toLowerCase()}`,
      shape_source_kind: 'official_web',
      shape_metadata: {
        streets: ['Calle 94', 'Carrera 71', 'Calle 30'],
      },
      origin_walk_meters: originWalkMeters,
      destination_walk_meters: destinationWalkMeters,
      total_walk_meters: originWalkMeters + destinationWalkMeters,
      bus_distance_meters: busDistanceMeters,
      total_distance_meters: originWalkMeters + destinationWalkMeters + busDistanceMeters,
      origin_fraction: 0.1,
      destination_fraction: 0.9,
      boarding_point: {
        type: 'Point',
        coordinates: [-74.815, 11.022],
      },
      alighting_point: {
        type: 'Point',
        coordinates: [-74.785, 10.945],
      },
    });
    dataSourceQuery.mockResolvedValueOnce([
      makeSuggestionRow('D6-4150', 145, 84, 9200),
      makeSuggestionRow('D7-4151', 145, 84, 9100),
      makeSuggestionRow('B10-4126', 353, 98, 8800),
      makeSuggestionRow('B9-4125', 436, 161, 8700),
      makeSuggestionRow('C7-4138', 233, 695, 9500),
    ]);

    const response = await service.getTransitBusSuggestions({
      origin: { latitude: 11.022365, longitude: -74.815515, label: 'Villa Carolina' },
      destination: { latitude: 10.94539, longitude: -74.78514, label: 'Panorama' },
      mode: TransitMode.PEATON,
    });

    expect(response).toMatchObject({
      puntoA: { label: 'Villa Carolina' },
      puntoB: { label: 'Panorama' },
    });
    expect(response.suggestions).toHaveLength(4);
    expect(response.rutasPosibles).toHaveLength(4);
    expect(response.coverage.hasSuggestions).toBe(true);
    expect(response.suggestions[0]).toMatchObject({
      optionNumber: 1,
      title: 'Opcion 1: B9-4125 - Operador',
      route: {
        shortName: 'B9-4125',
      },
      seleccion: {
        pasos: [
          { type: 'walk_to_boarding' },
          { type: 'board_bus' },
          { type: 'alight_bus' },
          { type: 'walk_to_destination' },
        ],
      },
      steps: [
        { type: 'walk_to_boarding' },
        { type: 'bus', routeShortName: 'B9-4125', streets: ['Calle 94', 'Carrera 71', 'Calle 30'] },
        { type: 'walk_to_destination' },
      ],
    });
  });

  it('omite instrucciones de caminar cuando el bus pasa por el punto o deja en la puerta', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        route_id: 'route-a15-4159',
        short_name: 'A15-4159',
        long_name: 'Ruta A15-4159',
        agency_kind: 'colectivo',
        route_source_kind: 'official_web',
        operator_name: 'COOCHOFAL',
        route_metadata: null,
        shape_id: 'shape-a15-4159',
        shape_source_kind: 'official_web',
        shape_metadata: { streets: [] },
        origin_walk_meters: 20,
        destination_walk_meters: 60,
        total_walk_meters: 80,
        bus_distance_meters: 7000,
        total_distance_meters: 7080,
        origin_fraction: 0.1,
        destination_fraction: 0.9,
        boarding_point: {
          type: 'Point',
          coordinates: [-74.815, 11.022],
        },
        alighting_point: {
          type: 'Point',
          coordinates: [-74.785, 10.945],
        },
      },
    ]);

    const response = await service.getTransitBusSuggestions({
      origin: { latitude: 11.022365, longitude: -74.815515, label: 'Villa Carolina' },
      destination: { latitude: 10.94539, longitude: -74.78514, label: 'Panorama' },
      mode: TransitMode.PEATON,
    });

    expect(response.rutasPosibles[0].steps.map((step) => step.type)).toEqual(['bus']);
    expect(response.rutasPosibles[0].seleccion?.pasos.map((step) => step.type)).toEqual([
      'board_bus',
      'alight_bus',
    ]);
    expect(response.rutasPosibles[0].seleccion?.pasos[0].instruction).toContain('en el Punto A');
    expect(response.rutasPosibles[0].seleccion?.pasos[1].instruction).toContain('en el Punto B');
  });

  it('filtra servicios expresos de Transmetro fuera de horas pico', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        feeder_route_id: 'route-a7-1',
        feeder_short_name: 'A7-1',
        feeder_long_name: 'Ruta A7-1 - Miramar',
        feeder_source_kind: 'osm_overpass',
        feeder_operator_name: 'Transmetro',
        feeder_route_metadata: null,
        trunk_route_id: 'route-s10',
        trunk_short_name: 'S10',
        trunk_long_name: 'Ruta expresa S10',
        trunk_source_kind: 'osm_overpass',
        trunk_operator_name: 'Transmetro',
        trunk_route_metadata: null,
        boarding_stop_id: 'stop-a7-1',
        boarding_stop_name: 'Parada A7-1',
        boarding_stop_point: { type: 'Point', coordinates: [-74.8338, 11.0033] },
        transfer_stop_id: 'stop-joe',
        transfer_stop_name: 'Estación retorno Joe Arroyo',
        transfer_stop_point: { type: 'Point', coordinates: [-74.8077, 10.9945] },
        destination_stop_id: 'stop-estadio',
        destination_stop_name: 'Joaquín Barrios Polo / Estadio Metropolitano',
        destination_stop_point: { type: 'Point', coordinates: [-74.7992, 10.9326] },
        origin_walk_meters: 150,
        destination_walk_meters: 650,
        feeder_distance_meters: 3000,
        trunk_distance_meters: 8000,
      },
    ]);

    const response = await service.getTransmetroSuggestions({
      origin: { latitude: 11.00343, longitude: -74.83528, label: 'Centro Comercial Miramar' },
      destination: { latitude: 10.92695, longitude: -74.80051, label: 'Estadio Metropolitano' },
      mode: TransitMode.PEATON,
      departureIso: '2026-07-28T12:00:00-05:00',
    });

    expect(response.rutasPosibles).toHaveLength(0);
    expect(response.coverage.hasSuggestions).toBe(false);
  });

  it('permite servicios expresos de Transmetro en horas pico', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        feeder_route_id: 'route-a7-1',
        feeder_short_name: 'A7-1',
        feeder_long_name: 'Ruta A7-1 - Miramar',
        feeder_source_kind: 'osm_overpass',
        feeder_operator_name: 'Transmetro',
        feeder_route_metadata: null,
        trunk_route_id: 'route-s10',
        trunk_short_name: 'S10',
        trunk_long_name: 'Ruta expresa S10',
        trunk_source_kind: 'osm_overpass',
        trunk_operator_name: 'Transmetro',
        trunk_route_metadata: null,
        boarding_stop_id: 'stop-a7-1',
        boarding_stop_name: 'Parada A7-1',
        boarding_stop_point: { type: 'Point', coordinates: [-74.8338, 11.0033] },
        transfer_stop_id: 'stop-joe',
        transfer_stop_name: 'Estación retorno Joe Arroyo',
        transfer_stop_point: { type: 'Point', coordinates: [-74.8077, 10.9945] },
        destination_stop_id: 'stop-estadio',
        destination_stop_name: 'Joaquín Barrios Polo / Estadio Metropolitano',
        destination_stop_point: { type: 'Point', coordinates: [-74.7992, 10.9326] },
        origin_walk_meters: 150,
        destination_walk_meters: 650,
        feeder_distance_meters: 3000,
        trunk_distance_meters: 8000,
      },
    ]);

    const response = await service.getTransmetroSuggestions({
      origin: { latitude: 11.00343, longitude: -74.83528, label: 'Centro Comercial Miramar' },
      destination: { latitude: 10.92695, longitude: -74.80051, label: 'Estadio Metropolitano' },
      mode: TransitMode.PEATON,
      departureIso: '2026-07-28T07:00:00-05:00',
    });

    expect(response.rutasPosibles).toHaveLength(1);
    expect(response.rutasPosibles[0].trunkService).toMatchObject({
      shortName: 'S10',
      isCurrentlyOperating: true,
      operatingCondition: 'peak_hours',
    });
  });
});
