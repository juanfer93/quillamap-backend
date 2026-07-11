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
  RouteCandidate,
  RouteCoordinate,
  RouteEngineProvider,
  RouteRiskAssessment,
  RouteResponse,
} from '@/features/navigation/interfaces/route-response.interface';

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: Array<[number, number]>;
  };
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

interface StreamRiskRow {
  id: string;
  description: string;
}

const ACTIVE_STREAM_BUFFER_METERS = 35;
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
    };
  }

  private async fetchRouteCandidates(routeRequest: RouteRequestDto): Promise<RouteCandidate[]> {
    const provider = this.getProvider();
    const routes = provider === 'osrm'
      ? await this.fetchOsrmRoutes(routeRequest)
      : await this.fetchValhallaRoutes(routeRequest);

    if (routes.length === 0) throw new ServiceUnavailableException('El motor de rutas no devolvio alternativas.');
    return Promise.all(routes.map((route) => this.withModeScores(route, routeRequest)));
  }

  private getProvider(): RouteEngineProvider {
    return this.configService.get<RouteEngineProvider>('ROUTING_ENGINE_PROVIDER') ?? 'osrm';
  }

  private async fetchOsrmRoutes(routeRequest: RouteRequestDto): Promise<RouteCandidate[]> {
    const response = await fetch(this.getOsrmUrl(routeRequest));
    const payload = await response.json() as OsrmResponse;

    if (!response.ok || payload.code !== 'Ok') throw new ServiceUnavailableException(payload.message);
    return (payload.routes ?? []).map((route) => this.fromOsrmRoute(route));
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

  private getOsrmUrl(routeRequest: RouteRequestDto): string {
    const baseUrl = this.configService.get<string>('OSRM_BASE_URL') ?? 'http://localhost:5000';
    const profile = routeRequest.mode === NavigationMode.PEATON ? 'walking' : 'driving';
    const origin = `${routeRequest.origin.longitude},${routeRequest.origin.latitude}`;
    const destination = `${routeRequest.destination.longitude},${routeRequest.destination.latitude}`;
    return `${baseUrl}/route/v1/${profile}/${origin};${destination}?overview=full&geometries=geojson&alternatives=true`;
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
        costing: routeRequest.mode === NavigationMode.PEATON ? 'pedestrian' : 'auto',
      }),
    };
  }

  private fromOsrmRoute(route: OsrmRoute): RouteCandidate {
    return {
      geometry: route.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      alerts: [],
      provider: 'osrm',
      legalStatus: 'allowed',
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
    const shadeScore = routeRequest.mode === NavigationMode.PEATON ? await this.safeCountShadeScore(route.geometry) : 0;
    const touristScore = routeRequest.mode === NavigationMode.TURISTA ? await this.safeCountTouristScore(route.geometry) : 0;
    return { ...route, shadeScore, touristScore };
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

  private async countShadeScore(geometry: RouteCoordinate[]): Promise<number> {
    const rows = await this.reportRepository.query(
      `select count(*)::int as total from report where type = $1 and status = $2 and ST_DWithin(location, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, 60)`,
      [ReportType.SOMBRA, ReportStatus.ACTIVO, JSON.stringify(this.toLineString(geometry))],
    ) as Array<{ total: number }>;
    return (rows[0]?.total ?? 0) * 90;
  }

  private async safeCountShadeScore(geometry: RouteCoordinate[]): Promise<number> {
    try {
      return await this.countShadeScore(geometry);
    } catch {
      return 0;
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
}
