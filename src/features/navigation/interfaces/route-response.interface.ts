import type { NavigationMode } from '@/features/navigation/dto/route-request.dto';

export type RouteEngineProvider = 'osrm' | 'valhalla';
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

export interface RouteResponse {
  geometry: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  alerts: RouteAlert[];
  provider: RouteEngineProvider;
  legalStatus: RouteLegalStatus;
  etaIso?: string;
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
