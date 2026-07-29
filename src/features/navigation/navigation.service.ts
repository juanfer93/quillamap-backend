import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { RestrictionType } from '@/features/zones/enums/restriction-type.enum';
import { Zone } from '@/features/zones/entities/zone.entity';
import { ZonesService } from '@/features/zones/zones.service';
import { NavigationMode, RouteRequestDto } from '@/features/navigation/dto/route-request.dto';
import type {
  RouteAlert,
  RouteAlternativeSummary,
  RouteCandidate,
  RouteCoordinate,
  RouteEngineProvider,
  RouteInstruction,
  RouteRiskAssessment,
  RouteResponse,
  RouteShadeSegment,
} from '@/features/navigation/interfaces/route-response.interface';

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: Array<[number, number]>;
  };
  legs?: Array<{
    steps?: Array<{
      name?: string;
      distance: number;
      duration: number;
      maneuver?: {
        type?: string;
        modifier?: string;
        location?: [number, number];
      };
    }>;
  }>;
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
}

interface ValhallaResponse {
  trip?: {
    status: number;
    status_message?: string;
    summary: {
      length: number;
      time: number;
    };
    legs: Array<{
      shape: string;
    }>;
  };
}

interface TomTomRoute {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds?: number;
  };
  legs?: Array<{
    points?: RouteCoordinate[];
  }>;
  guidance?: {
    instructions?: Array<{
      routeOffsetInMeters?: number;
      travelTimeInSeconds?: number;
      point?: RouteCoordinate;
      message?: string;
      combinedMessage?: string;
      maneuver?: string;
      instructionType?: string;
      street?: string;
      roadNumbers?: string[];
    }>;
  };
}

interface TomTomResponse {
  routes?: TomTomRoute[];
}

interface StreamRiskRow {
  id: string;
  description: string;
}

interface ThermalComfortRow {
  matched_shade_reports?: number;
  matchedShadeReports?: number;
  matched_parks?: number;
  matchedParks?: number;
  shade_score_seconds?: number;
  shadeScoreSeconds?: number;
  heat_penalty_seconds?: number;
  heatPenaltySeconds?: number;
  shade_segments?: unknown;
  shadeSegments?: unknown;
}

interface ThermalComfortAssessment {
  scoreSeconds: number;
  shadeSegments: RouteShadeSegment[];
}

const ACTIVE_STREAM_BUFFER_METERS = 35;
const AMB_BOUNDS = {
  minLatitude: 10.82,
  maxLatitude: 11.12,
  minLongitude: -75.1,
  maxLongitude: -74.68,
} as const;
const SHADE_REPORT_BUFFER_METERS = 60;
const PARK_BUFFER_METERS = 45;
const SHADE_REPORT_REWARD_SECONDS = 90;
const PARK_SEGMENT_REWARD_SECONDS = 120;
const UNSHADED_WALK_PENALTY_SECONDS = 45;
const INFINITE_PENALTY_SECONDS = 2_147_483_647;

@Injectable()
export class NavigationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly zonesService: ZonesService,
    @InjectRepository(Zone) private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(Report) private readonly reportRepository: Repository<Report>,
  ) {}

  async calculateRoute(routeRequest: RouteRequestDto): Promise<RouteResponse> {
    this.assertRequestWithinAmb(routeRequest);
    const candidates = await this.fetchRouteCandidates(routeRequest);
    const assessed = await Promise.all(candidates.map((candidate) => this.assessRoute(candidate, routeRequest)));
    const legalRoutes = assessed.filter((candidate) => !candidate.risk.isLegalBlocked);
    const safeRoutes = legalRoutes.filter((candidate) => !candidate.risk.hasRisk);

    if (safeRoutes.length > 0) {
      const bestRoute = this.pickBestRoute(safeRoutes);
      return this.toResponse(bestRoute, assessed[0].route !== bestRoute);
    }

    if (legalRoutes.length > 0) {
      const bestRouteWithAlerts = this.pickBestRoute(legalRoutes);
      return this.toResponse(bestRouteWithAlerts, assessed[0].route !== bestRouteWithAlerts);
    }

    throw new BadRequestException('La placa o el tipo de vehiculo violan una restriccion activa.');
  }

  private async assessRoute(route: RouteCandidate, routeRequest: RouteRequestDto) {
    const risk = await this.getRiskAssessment(route, routeRequest);
    const penalty = risk.hasRisk ? INFINITE_PENALTY_SECONDS : 0;
    const score = route.durationSeconds + penalty - route.shadeScore - route.touristScore;

    return { route: { ...route, alerts: risk.alerts }, risk, score };
  }

  private pickBestRoute(
    routes: Array<{ route: RouteCandidate; risk: RouteRiskAssessment; score: number }>
  ): RouteCandidate {
    return [...routes].sort((left, right) => left.score - right.score)[0].route;
  }

  private toResponse(route: RouteCandidate, rerouted: boolean): RouteResponse {
    return {
      geometry: route.geometry,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      alerts: route.alerts,
      provider: route.provider,
      legalStatus: rerouted ? 'rerouted' : 'allowed',
      etaIso: new Date(Date.now() + route.durationSeconds * 1000).toISOString(),
      instructions: route.instructions,
      alternatives: route.alternatives,
      selectedRouteIndex: route.selectedRouteIndex,
      trafficDelaySeconds: route.trafficDelaySeconds,
      shadeSegments: route.shadeSegments,
    };
  }

  private async fetchRouteCandidates(routeRequest: RouteRequestDto): Promise<RouteCandidate[]> {
    const provider = this.getProvider(routeRequest);
    const routes = provider === 'osrm'
      ? await this.fetchOsrmRoutes(routeRequest)
      : provider === 'tomtom'
        ? await this.fetchTomTomRoutes(routeRequest)
        : await this.fetchValhallaRoutes(routeRequest);

    if (routes.length === 0) throw new ServiceUnavailableException('El motor de rutas no devolvio alternativas.');
    return Promise.all(routes.map((route) => this.withModeScores(route, routeRequest)));
  }

  private getProvider(routeRequest: RouteRequestDto): RouteEngineProvider {
    const configuredProvider = this.configService.get<RouteEngineProvider>('ROUTING_ENGINE_PROVIDER');

    if (configuredProvider === 'tomtom' && this.isWalkingMode(routeRequest.mode)) {
      return 'osrm';
    }

    if (configuredProvider) {
      return configuredProvider;
    }

    return this.shouldUseTomTomTraffic(routeRequest.mode) ? 'tomtom' : 'osrm';
  }

  private async fetchOsrmRoutes(routeRequest: RouteRequestDto): Promise<RouteCandidate[]> {
    const response = await fetch(this.getOsrmUrl(routeRequest));
    const payload = await response.json() as OsrmResponse;

    if (!response.ok || payload.code !== 'Ok') throw new ServiceUnavailableException(payload.message);
    const routes = payload.routes ?? [];
    return routes.map((route, index) => this.fromOsrmRoute(route, index, routes));
  }

  private async fetchValhallaRoutes(routeRequest: RouteRequestDto): Promise<RouteCandidate[]> {
    const response = await fetch(this.getValhallaUrl(), this.getValhallaRequest(routeRequest));
    const payload = await response.json() as ValhallaResponse;

    if (!response.ok) throw new ServiceUnavailableException('Valhalla no esta disponible.');
    if (!payload.trip || payload.trip.status !== 0) {
      throw new ServiceUnavailableException(payload.trip?.status_message);
    }

    return [this.fromValhallaRoute(payload)];
  }

  private async fetchTomTomRoutes(routeRequest: RouteRequestDto): Promise<RouteCandidate[]> {
    const apiKey = this.getTomTomApiKey();
    const response = await fetch(this.getTomTomUrl(routeRequest, apiKey));
    const payload = await response.json() as TomTomResponse;

    if (!response.ok) throw new ServiceUnavailableException('TomTom no esta disponible.');
    const routes = payload.routes ?? [];
    return routes.map((route, index) => this.fromTomTomRoute(route, index, routes));
  }

  private getOsrmUrl(routeRequest: RouteRequestDto): string {
    const baseUrl = this.getOsrmBaseUrl(routeRequest.mode);
    const profile = this.getOsrmProfile(routeRequest.mode);
    const origin = `${routeRequest.origin.longitude},${routeRequest.origin.latitude}`;
    const destination = `${routeRequest.destination.longitude},${routeRequest.destination.latitude}`;
    return `${baseUrl}/route/v1/${profile}/${origin};${destination}?overview=full&geometries=geojson&steps=true&alternatives=true`;
  }

  private getOsrmBaseUrl(mode: NavigationMode): string {
    if (this.isWalkingMode(mode)) {
      return this.configService.get<string>('OSRM_WALKING_BASE_URL') ?? 'http://localhost:5001';
    }

    return this.configService.get<string>('OSRM_DRIVING_BASE_URL') ??
      this.configService.get<string>('OSRM_BASE_URL') ??
      'http://localhost:5000';
  }

  private getOsrmProfile(mode: NavigationMode): 'walking' | 'driving' {
    return this.isWalkingMode(mode) ? 'walking' : 'driving';
  }

  private getValhallaUrl(): string {
    const baseUrl = this.configService.get<string>('VALHALLA_BASE_URL') ?? 'http://localhost:8002';
    return `${baseUrl}/route`;
  }

  private getValhallaRequest(routeRequest: RouteRequestDto): RequestInit {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [routeRequest.origin, routeRequest.destination],
        costing: this.isWalkingMode(routeRequest.mode) ? 'pedestrian' : 'auto',
      }),
    };
  }

  private getTomTomUrl(routeRequest: RouteRequestDto, apiKey: string): string {
    const baseUrl = this.configService.get<string>('TOMTOM_ROUTING_BASE_URL') ?? 'https://api.tomtom.com';
    const origin = `${routeRequest.origin.latitude},${routeRequest.origin.longitude}`;
    const destination = `${routeRequest.destination.latitude},${routeRequest.destination.longitude}`;
    const params = new URLSearchParams({
      key: apiKey,
      traffic: 'true',
      travelMode: 'car',
      routeRepresentation: 'polyline',
      computeTravelTimeFor: 'all',
      sectionType: 'traffic',
      maxAlternatives: '2',
      instructionsType: 'text',
      language: this.configService.get<string>('TOMTOM_LANGUAGE') ?? 'es-ES',
    });

    return `${baseUrl}/routing/1/calculateRoute/${origin}:${destination}/json?${params.toString()}`;
  }

  private getTomTomApiKey(): string {
    const apiKey = this.configService.get<string>('TOMTOM_API_KEY')?.trim();

    if (!apiKey) {
      throw new ServiceUnavailableException('TOMTOM_API_KEY no esta configurada.');
    }

    return apiKey;
  }

  private fromOsrmRoute(route: OsrmRoute, index = 0, alternatives: OsrmRoute[] = [route]): RouteCandidate {
    return {
      geometry: route.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      alerts: [],
      provider: 'osrm',
      legalStatus: 'allowed',
      instructions: this.getOsrmInstructions(route),
      alternatives: alternatives.map((candidate, candidateIndex) => this.toOsrmAlternativeSummary(candidate, candidateIndex)),
      selectedRouteIndex: index,
      shadeScore: 0,
      touristScore: 0,
    };
  }

  private fromValhallaRoute(payload: ValhallaResponse): RouteCandidate {
    const trip = payload.trip!;
    return {
      geometry: trip.legs.flatMap((leg) => this.decodePolyline(leg.shape)),
      distanceMeters: trip.summary.length * 1000,
      durationSeconds: trip.summary.time,
      alerts: [],
      provider: 'valhalla',
      legalStatus: 'allowed',
      shadeScore: 0,
      touristScore: 0,
    };
  }

  private fromTomTomRoute(route: TomTomRoute, index = 0, alternatives: TomTomRoute[] = [route]): RouteCandidate {
    return {
      geometry: this.getTomTomGeometry(route),
      distanceMeters: route.summary.lengthInMeters,
      durationSeconds: route.summary.travelTimeInSeconds,
      alerts: [],
      provider: 'tomtom',
      legalStatus: 'allowed',
      instructions: this.getTomTomInstructions(route),
      alternatives: alternatives.map((candidate, candidateIndex) => this.toTomTomAlternativeSummary(candidate, candidateIndex)),
      selectedRouteIndex: index,
      trafficDelaySeconds: route.summary.trafficDelayInSeconds,
      shadeScore: 0,
      touristScore: 0,
    };
  }

  private toOsrmAlternativeSummary(route: OsrmRoute, index: number): RouteAlternativeSummary {
    return {
      index,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometryPoints: route.geometry.coordinates.length,
      provider: 'osrm',
    };
  }

  private toTomTomAlternativeSummary(route: TomTomRoute, index: number): RouteAlternativeSummary {
    return {
      index,
      distanceMeters: route.summary.lengthInMeters,
      durationSeconds: route.summary.travelTimeInSeconds,
      geometryPoints: this.getTomTomGeometry(route).length,
      provider: 'tomtom',
    };
  }

  private getOsrmInstructions(route: OsrmRoute): RouteInstruction[] {
    return route.legs?.[0]?.steps?.map((step, index) => {
      const street = step.name?.trim() || 'Tramo sin nombre';
      const message = [
        step.maneuver?.type,
        step.maneuver?.modifier,
        step.name ? `en ${step.name}` : null,
      ].filter(Boolean).join(' ') || 'Continuar';
      const [longitude, latitude] = step.maneuver?.location ?? [];

      return {
        index: index + 1,
        message,
        street,
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        coordinate: typeof latitude === 'number' && typeof longitude === 'number'
          ? { latitude, longitude }
          : undefined,
      };
    }) ?? [];
  }

  private getTomTomInstructions(route: TomTomRoute): RouteInstruction[] {
    return route.guidance?.instructions?.map((instruction, index) => ({
      index: index + 1,
      message: instruction.message ?? instruction.combinedMessage ?? instruction.maneuver ?? instruction.instructionType ?? 'Continuar',
      street: instruction.street ?? instruction.roadNumbers?.join(', ') ?? 'Tramo sin nombre',
      distanceMeters: instruction.routeOffsetInMeters,
      durationSeconds: instruction.travelTimeInSeconds,
      coordinate: instruction.point,
    })) ?? [];
  }

  private getTomTomGeometry(route: TomTomRoute): RouteCoordinate[] {
    const points = route.legs?.flatMap((leg) => leg.points ?? []) ?? [];

    return points.filter((point, index) => {
      const previous = points[index - 1];
      return !previous || previous.latitude !== point.latitude || previous.longitude !== point.longitude;
    });
  }

  private decodePolyline(shape: string, precision = 6): RouteCoordinate[] {
    const factor = 10 ** precision;
    const coordinates: RouteCoordinate[] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;

    while (index < shape.length) {
      const latResult = this.decodeChunk(shape, index);
      index = latResult.nextIndex;
      const lngResult = this.decodeChunk(shape, index);
      index = lngResult.nextIndex;
      latitude += latResult.delta;
      longitude += lngResult.delta;
      coordinates.push({ latitude: latitude / factor, longitude: longitude / factor });
    }

    return coordinates;
  }

  private decodeChunk(shape: string, startIndex: number): { delta: number; nextIndex: number } {
    let result = 0;
    let shift = 0;
    let index = startIndex;
    let byte = 0;

    do {
      byte = shape.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    return { delta: result & 1 ? ~(result >> 1) : result >> 1, nextIndex: index };
  }

  private async withModeScores(route: RouteCandidate, routeRequest: RouteRequestDto): Promise<RouteCandidate> {
    const thermalComfort = routeRequest.mode === NavigationMode.PEATON && routeRequest.preferences?.prioritizeShade !== false
      ? await this.safeGetThermalComfort(route.geometry)
      : { scoreSeconds: 0, shadeSegments: [] };
    const shadeScore = thermalComfort.scoreSeconds;
    const touristScore = routeRequest.mode === NavigationMode.TURISTA ? await this.safeCountTouristScore(route.geometry) : 0;
    return { ...route, shadeScore, touristScore, shadeSegments: thermalComfort.shadeSegments };
  }

  private isWalkingMode(mode: NavigationMode): boolean {
    return mode === NavigationMode.PEATON || mode === NavigationMode.TURISTA;
  }

  private shouldUseTomTomTraffic(mode: NavigationMode): boolean {
    return !this.isWalkingMode(mode) && Boolean(this.configService.get<string>('TOMTOM_API_KEY')?.trim());
  }

  private async getRiskAssessment(route: RouteCandidate, routeRequest: RouteRequestDto): Promise<RouteRiskAssessment> {
    try {
      const [zones, streams] = await Promise.all([
        this.findIntersectingZones(route.geometry),
        this.findActiveStreams(route.geometry),
      ]);
      const zoneAlerts = await this.getZoneAlerts(zones, routeRequest);
      const streamAlerts = streams.map((stream) => this.toStreamAlert(stream));
      return this.toRiskAssessment([...zoneAlerts, ...streamAlerts], zoneAlerts);
    } catch {
      return this.toRiskAssessment([this.toRiskValidationAlert()], []);
    }
  }

  private toRiskAssessment(alerts: RouteAlert[], legalAlerts: RouteAlert[]): RouteRiskAssessment {
    return {
      alerts,
      hasRisk: alerts.length > 0,
      isLegalBlocked: legalAlerts.some((alert) => alert.type === 'pico_y_placa' || alert.type === 'restriccion_parrillero'),
    };
  }

  private async findIntersectingZones(geometry: RouteCoordinate[]): Promise<Zone[]> {
    return this.zoneRepository.query(
      `select * from zones where active = true and ST_Intersects(boundary, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))`,
      [JSON.stringify(this.toLineString(geometry))],
    );
  }

  private async findActiveStreams(geometry: RouteCoordinate[]): Promise<StreamRiskRow[]> {
    return this.reportRepository.query(
      `select id, description from report where type = $1 and status = $2 and ST_DWithin(location, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, $4)`,
      [ReportType.ARROYO, ReportStatus.ACTIVO, JSON.stringify(this.toLineString(geometry)), ACTIVE_STREAM_BUFFER_METERS],
    );
  }

  private async getZoneAlerts(zones: Zone[], routeRequest: RouteRequestDto): Promise<RouteAlert[]> {
    const alerts = await Promise.all(zones.map((zone) => this.toZoneAlert(zone, routeRequest)));
    return alerts.filter((alert): alert is RouteAlert => alert !== null);
  }

  private async toZoneAlert(zone: Zone, routeRequest: RouteRequestDto): Promise<RouteAlert | null> {
    const vehicleType = this.toVehicleType(routeRequest.mode);
    const restricted = await this.zonesService.isRestricted(zone.id, {
      type: vehicleType,
      plate: routeRequest.licensePlate ?? '',
      dateTime: new Date(),
    });

    if (!restricted.restricted) return null;
    return this.toLegalAlert(zone, restricted.reason);
  }

  private toLegalAlert(zone: Zone, reason: RestrictionType | null): RouteAlert {
    return {
      id: zone.id,
      type: reason === RestrictionType.PARRILLERO_HOMBRE ? 'restriccion_parrillero' : 'pico_y_placa',
      severity: 'danger',
      title: `Restriccion legal activa: ${zone.name}`,
      description: reason ?? undefined,
      penaltySeconds: INFINITE_PENALTY_SECONDS,
    };
  }

  private toStreamAlert(stream: StreamRiskRow): RouteAlert {
    return {
      id: stream.id,
      type: 'arroyo_activo',
      severity: 'danger',
      title: 'Arroyo activo en la ruta',
      description: stream.description,
      penaltySeconds: INFINITE_PENALTY_SECONDS,
    };
  }

  private toRiskValidationAlert(): RouteAlert {
    return {
      id: 'risk-validation-unavailable',
      type: 'zona_restringida',
      severity: 'warning',
      title: 'Ruta calculada sin validacion completa de riesgos',
      description: 'No fue posible consultar zonas o reportes activos durante el calculo.',
    };
  }

  private toVehicleType(mode: NavigationMode): VehicleType {
    if (mode === NavigationMode.MOTO) return VehicleType.MOTO;
    if (mode === NavigationMode.CARRO) return VehicleType.PARTICULAR;
    return VehicleType.PEATON;
  }

  private async getThermalComfort(geometry: RouteCoordinate[]): Promise<ThermalComfortAssessment> {
    const rows = await this.reportRepository.query(
      `
      with route as (
        select ST_SetSRID(ST_GeomFromGeoJSON($3), 4326) as geom
      ),
      route_segments as (
        select dumped.path[1] as segment_index, dumped.geom as geom
        from route
        cross join lateral ST_DumpSegments(route.geom) as dumped(path, geom)
      ),
      community_segments as (
        select distinct
          concat('shade-report-', report.id::text, '-', route_segments.segment_index::text) as id,
          'community_report' as source,
          route_segments.geom
        from route_segments
        join report
          on report.type = $1
          and report.status = $2
          and ST_DWithin(report.location, route_segments.geom::geography, $4)
      ),
      park_segments as (
        select distinct
          concat('green-coverage-', coverage.id::text, '-', route_segments.segment_index::text) as id,
          case when coverage.type = 'park' then 'park' else 'green_coverage' end as source,
          route_segments.geom
        from route_segments
        join amb_green_coverage coverage
          on coverage.type in ('tree', 'park', 'grass')
          and ST_DWithin(
            coverage.geometry,
            route_segments.geom::geography,
            $5
          )
      ),
      matched_segments as (
        select * from community_segments
        union all
        select * from park_segments
      )
      select
        (select count(distinct id)::int from community_segments) as matched_shade_reports,
        (select count(distinct id)::int from park_segments) as matched_parks,
        case
          when count(*) = 0 then -$8::int
          else
            (select count(distinct id)::int from community_segments) * $6::int +
            (select count(distinct id)::int from park_segments) * $7::int
        end as shade_score_seconds,
        case when count(*) = 0 then $8::int else 0 end as heat_penalty_seconds,
        coalesce(
          json_agg(
            json_build_object(
              'id', id,
              'source', source,
              'geometry', ST_AsGeoJSON(geom)::json
            )
            order by id
          ) filter (where id is not null),
          '[]'::json
        ) as shade_segments
      from matched_segments
      `,
      [
        ReportType.SOMBRA,
        ReportStatus.ACTIVO,
        JSON.stringify(this.toLineString(geometry)),
        SHADE_REPORT_BUFFER_METERS,
        PARK_BUFFER_METERS,
        SHADE_REPORT_REWARD_SECONDS,
        PARK_SEGMENT_REWARD_SECONDS,
        UNSHADED_WALK_PENALTY_SECONDS,
      ],
    ) as ThermalComfortRow[];
    const row = rows[0];
    const scoreSeconds = this.toNumber(row?.shade_score_seconds ?? row?.shadeScoreSeconds, -UNSHADED_WALK_PENALTY_SECONDS);

    return {
      scoreSeconds,
      shadeSegments: this.toShadeSegments(row?.shade_segments ?? row?.shadeSegments),
    };
  }

  private async safeGetThermalComfort(geometry: RouteCoordinate[]): Promise<ThermalComfortAssessment> {
    try {
      return await this.getThermalComfort(geometry);
    } catch {
      return { scoreSeconds: 0, shadeSegments: [] };
    }
  }

  private async countTouristScore(geometry: RouteCoordinate[]): Promise<number> {
    const rows = await this.zoneRepository.query(
      `select case when to_regclass('tourist_sites') is null then 0 else (select count(*)::int from tourist_sites where ST_DWithin(location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography, 80)) end as total`,
      [JSON.stringify(this.toLineString(geometry))],
    ) as Array<{ total: number }>;
    return (rows[0]?.total ?? 0) * 120;
  }

  private async safeCountTouristScore(geometry: RouteCoordinate[]): Promise<number> {
    try {
      return await this.countTouristScore(geometry);
    } catch {
      return 0;
    }
  }

  private toLineString(geometry: RouteCoordinate[]) {
    return {
      type: 'LineString' as const,
      coordinates: geometry.map((point) => [point.longitude, point.latitude]),
    };
  }

  private assertRequestWithinAmb(routeRequest: RouteRequestDto): void {
    if (this.isWithinAmbBounds(routeRequest.origin) && this.isWithinAmbBounds(routeRequest.destination)) {
      return;
    }

    throw new BadRequestException('El algoritmo peatonal de confort termico solo opera dentro del AMB.');
  }

  private isWithinAmbBounds(coordinate: RouteCoordinate): boolean {
    return coordinate.latitude >= AMB_BOUNDS.minLatitude &&
      coordinate.latitude <= AMB_BOUNDS.maxLatitude &&
      coordinate.longitude >= AMB_BOUNDS.minLongitude &&
      coordinate.longitude <= AMB_BOUNDS.maxLongitude;
  }

  private toNumber(value: unknown, fallback = 0): number {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : fallback;
  }

  private toShadeSegments(value: unknown): RouteShadeSegment[] {
    const rawSegments = typeof value === 'string' ? JSON.parse(value) as unknown : value;

    if (!Array.isArray(rawSegments)) {
      return [];
    }

    return rawSegments.flatMap((segment): RouteShadeSegment[] => {
      const candidate = segment as {
        id?: unknown;
        source?: unknown;
        geometry?: {
          type?: unknown;
          coordinates?: unknown;
        };
      };

      if (
        typeof candidate.id !== 'string' ||
        (
          candidate.source !== 'community_report' &&
          candidate.source !== 'green_coverage' &&
          candidate.source !== 'park'
        ) ||
        candidate.geometry?.type !== 'LineString' ||
        !Array.isArray(candidate.geometry.coordinates)
      ) {
        return [];
      }

      const geometry = candidate.geometry.coordinates.flatMap((coordinate): RouteCoordinate[] => {
        if (
          !Array.isArray(coordinate) ||
          coordinate.length < 2 ||
          !Number.isFinite(coordinate[0]) ||
          !Number.isFinite(coordinate[1])
        ) {
          return [];
        }

        return [{ longitude: coordinate[0], latitude: coordinate[1] }];
      });

      return geometry.length > 1
        ? [{ id: candidate.id, source: candidate.source, geometry }]
        : [];
    });
  }
}
