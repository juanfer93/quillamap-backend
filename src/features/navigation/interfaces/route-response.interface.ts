import type { NavigationMode } from '@/features/navigation/dto/route-request.dto';

export type RouteEngineProvider = 'osrm' | 'valhalla' | 'tomtom';
export type RouteLegalStatus = 'allowed' | 'blocked' | 'rerouted';
export type RouteAlertSeverity = 'info' | 'warning' | 'danger';

export type RouteAlertType =
  | 'arroyo_activo'
  | 'pico_y_placa'
  | 'restriccion_parrillero'
  | 'zona_restringida'
  | 'sombra'
  | 'hito_cultural';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteAlert {
  id: string;
  type: RouteAlertType;
  severity: RouteAlertSeverity;
  title: string;
  description?: string;
  distanceMeters?: number;
  penaltySeconds?: number;
}

export interface RouteInstruction {
  index: number;
  message: string;
  street?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  coordinate?: RouteCoordinate;
}

export interface RouteAlternativeSummary {
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  geometryPoints: number;
  provider: RouteEngineProvider;
}

export type RouteShadeSegmentSource = 'community_report' | 'green_coverage' | 'park';

export interface RouteShadeSegment {
  id: string;
  source: RouteShadeSegmentSource;
  geometry: RouteCoordinate[];
}

export interface RouteResponse {
  geometry: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  alerts: RouteAlert[];
  provider: RouteEngineProvider;
  legalStatus: RouteLegalStatus;
  etaIso?: string;
  instructions?: RouteInstruction[];
  alternatives?: RouteAlternativeSummary[];
  selectedRouteIndex?: number;
  trafficDelaySeconds?: number;
  shadeSegments?: RouteShadeSegment[];
}

export interface RouteCandidate extends RouteResponse {
  shadeScore: number;
  touristScore: number;
}

export interface RouteRiskAssessment {
  alerts: RouteAlert[];
  hasRisk: boolean;
  isLegalBlocked: boolean;
}

export interface RouteEngineRequest {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  mode: NavigationMode;
}
