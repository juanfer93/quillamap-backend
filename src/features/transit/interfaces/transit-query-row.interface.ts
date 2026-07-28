import type {
  TransitMapRouteFeature,
  TransitMapStopFeature,
  TransitRouteOperatingCondition,
  TransitRouteStreetsResponse,
} from '@/features/transit/interfaces/transit-response.interface';

export interface ActiveStreamHit {
  id: string;
  description: string | null;
}

export interface PresenceValidationRow {
  id: string;
  distance_meters: number;
}

export interface TransitRouteMetadata {
  operatingCondition?: TransitRouteOperatingCondition;
  operatingConditionLabel?: string;
  isCurrentlyOperatingOverride?: boolean;
  seasonalWindow?: {
    startsOn?: string;
    endsOn?: string;
  };
  peakHours?: {
    weekdaysOnly?: boolean;
    windows?: Array<{
      startsAt: string;
      endsAt: string;
    }>;
  };
}

export interface TransitShapeMetadata {
  direction?: string;
  directionLabel?: string;
  geometryStatus?: string;
  streets?: unknown;
}

export interface TransitOperatingStatus {
  isCurrentlyOperating: boolean;
  operatingCondition: TransitRouteOperatingCondition;
  operatingConditionLabel?: string;
}

export interface TransitMapRouteRow {
  id: string;
  route_id: string;
  short_name: string;
  long_name: string | null;
  agency_kind: 'transmetro' | 'colectivo';
  source_kind: TransitMapRouteFeature['properties']['sourceKind'];
  operator_name: string | null;
  route_metadata: TransitRouteMetadata | null;
  streets: string[] | null;
  geometry: TransitMapRouteFeature['geometry'];
}

export interface TransitMapStopRow {
  id: string;
  route_id: string | null;
  name: string;
  agency_kind: 'transmetro' | 'colectivo';
  source_kind: TransitMapStopFeature['properties']['sourceKind'];
  geometry: TransitMapStopFeature['geometry'];
}

export interface TransitRouteStreetsRow {
  route_id: string;
  short_name: string;
  long_name: string | null;
  agency_kind: 'transmetro' | 'colectivo';
  route_source_kind: TransitRouteStreetsResponse['route']['sourceKind'];
  operator_name: string | null;
  route_metadata: TransitRouteMetadata | null;
  shape_id: string | null;
  shape_source_kind: TransitRouteStreetsResponse['route']['sourceKind'] | null;
  shape_metadata: TransitShapeMetadata | null;
  coordinates_count: number | string | null;
}

export interface TransitBusSuggestionRow {
  route_id: string;
  short_name: string;
  long_name: string | null;
  agency_kind: 'transmetro' | 'colectivo';
  route_source_kind: TransitRouteStreetsResponse['route']['sourceKind'];
  operator_name: string | null;
  route_metadata: TransitRouteMetadata | null;
  shape_id: string;
  shape_source_kind: TransitRouteStreetsResponse['route']['sourceKind'];
  shape_metadata: TransitShapeMetadata | null;
  origin_walk_meters: number | string;
  destination_walk_meters: number | string;
  total_walk_meters: number | string;
  bus_distance_meters: number | string;
  total_distance_meters: number | string;
  origin_fraction: number | string;
  destination_fraction: number | string;
  boarding_point: {
    type: 'Point';
    coordinates: [number, number];
  };
  alighting_point: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface TransitTransmetroSuggestionRow {
  feeder_route_id: string;
  feeder_short_name: string;
  feeder_long_name: string | null;
  feeder_source_kind: TransitRouteStreetsResponse['route']['sourceKind'];
  feeder_operator_name: string | null;
  feeder_route_metadata: TransitRouteMetadata | null;
  trunk_route_id: string;
  trunk_short_name: string;
  trunk_long_name: string | null;
  trunk_source_kind: TransitRouteStreetsResponse['route']['sourceKind'];
  trunk_operator_name: string | null;
  trunk_route_metadata: TransitRouteMetadata | null;
  boarding_stop_id: string;
  boarding_stop_name: string;
  boarding_stop_point: {
    type: 'Point';
    coordinates: [number, number];
  };
  transfer_stop_id: string;
  transfer_stop_name: string;
  transfer_stop_point: {
    type: 'Point';
    coordinates: [number, number];
  };
  destination_stop_id: string;
  destination_stop_name: string;
  destination_stop_point: {
    type: 'Point';
    coordinates: [number, number];
  };
  origin_walk_meters: number | string;
  destination_walk_meters: number | string;
  feeder_distance_meters: number | string;
  trunk_distance_meters: number | string;
}

export interface OsrmWalkingResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    legs?: Array<{
      steps?: Array<{
        name?: string;
        ref?: string;
      }>;
    }>;
  }>;
}

export interface TransitWalkingEstimate {
  distanceMeters: number;
  durationSeconds: number;
  streets: string[];
}
