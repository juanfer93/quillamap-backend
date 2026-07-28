export type TransitLegType = 'walk' | 'bus' | 'transfer';
export type TransitRiskStatus = 'clear' | 'warning' | 'rerouted' | 'blocked';
export type TransitAlertSeverity = 'info' | 'warning' | 'danger';
export type TransitAlertType =
  | 'active_stream'
  | 'flooded_stop'
  | 'flooded_segment'
  | 'temporary_service'
  | 'manual_override'
  | 'community_validation'
  | 'cultural_landmark';

export interface TransitCoordinate {
  latitude: number;
  longitude: number;
}

export interface TransitWaypoint extends TransitCoordinate {
  label?: string;
}

export interface TransitLeg {
  id: string;
  type: TransitLegType;
  geometry: TransitCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  from: TransitWaypoint;
  to: TransitWaypoint;
  routeId?: string;
  routeShortName?: string;
  agencyKind?: 'transmetro' | 'colectivo';
  stopId?: string;
  headsign?: string;
}

export interface TransitAlert {
  id: string;
  type: TransitAlertType;
  severity: TransitAlertSeverity;
  title: string;
  description?: string;
  coordinate?: TransitCoordinate;
  routeId?: string;
  stopId?: string;
}

export interface TransitItinerary {
  id: string;
  mode: 'peaton' | 'turista';
  legs: TransitLeg[];
  alerts: TransitAlert[];
  riskStatus: TransitRiskStatus;
  distanceMeters: number;
  durationSeconds: number;
  transfers: number;
  sourceVersion: string;
  recalculatedForRisk: boolean;
  etaIso?: string;
}

export interface TransitDataSourceSnapshot {
  id: string;
  kind:
    | 'official_gtfs'
    | 'official_web'
    | 'datos_abiertos'
    | 'tumi_reference'
    | 'osm_overpass'
    | 'secondary_reference'
    | 'manual_override';
  sourceUrl?: string;
  version: string;
  fetchedAtIso: string;
  publishedAtIso?: string;
  checksum?: string;
  notes?: string;
}

export interface TransitRouteResponse {
  itineraries: TransitItinerary[];
  sourceSnapshots: TransitDataSourceSnapshot[];
  generatedAtIso: string;
}

export type TransitMapFeatureKind = 'route' | 'stop';
export type TransitRouteOperatingCondition =
  | 'always'
  | 'peak_hours'
  | 'christmas_season'
  | 'weekends'
  | 'temporarily_suspended';

export interface TransitMapFeatureProperties {
  id: string;
  kind: TransitMapFeatureKind;
  routeId?: string;
  shortName?: string;
  longName?: string;
  agencyKind: 'transmetro' | 'colectivo';
  sourceKind?: TransitDataSourceSnapshot['kind'];
  operatorName?: string;
  name?: string;
  streets?: string[];
  isCurrentlyOperating?: boolean;
  operatingCondition?: TransitRouteOperatingCondition;
  operatingConditionLabel?: string;
  color: string;
}

export interface TransitMapRouteFeature {
  type: 'Feature';
  id: string;
  properties: TransitMapFeatureProperties & {
    kind: 'route';
    routeId: string;
    shortName: string;
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface TransitMapStopFeature {
  type: 'Feature';
  id: string;
  properties: TransitMapFeatureProperties & {
    kind: 'stop';
    name: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface TransitMapResponse {
  type: 'FeatureCollection';
  features: Array<TransitMapRouteFeature | TransitMapStopFeature>;
  generatedAtIso: string;
}

export interface TransitRouteStreetDirection {
  shapeId: string;
  sourceKind: TransitDataSourceSnapshot['kind'];
  directionLabel?: string;
  geometryStatus?: string;
  streets: string[];
  coordinatesCount: number;
}

export interface TransitRouteStreetsResponse {
  route: {
    id: string;
    shortName: string;
    longName?: string;
    agencyKind: 'transmetro' | 'colectivo';
    operatorName?: string;
    sourceKind: TransitDataSourceSnapshot['kind'];
    isCurrentlyOperating: boolean;
    operatingCondition: TransitRouteOperatingCondition;
    operatingConditionLabel?: string;
  };
  streets: string[];
  directions: TransitRouteStreetDirection[];
  coverage: {
    hasGeometry: boolean;
    hasStreetSequence: boolean;
    directionSplit: 'available' | 'not_available';
    note?: string;
  };
  generatedAtIso: string;
}

export type TransitSuggestionStepType = 'walk_to_boarding' | 'bus' | 'walk_to_destination';
export type TransitSuggestionSelectionStepType =
  | 'walk_to_boarding'
  | 'board_bus'
  | 'alight_bus'
  | 'walk_to_destination';

export interface TransitBusSuggestionStep {
  type: TransitSuggestionStepType;
  instruction: string;
  distanceMeters?: number;
  routeShortName?: string;
  operatorName?: string;
  from?: TransitWaypoint;
  to?: TransitWaypoint;
  streets?: string[];
}

export interface TransitBusSuggestionSelectionStep {
  type: TransitSuggestionSelectionStepType;
  instruction: string;
  distanceMeters?: number;
  durationSeconds?: number;
  from?: TransitWaypoint;
  to?: TransitWaypoint;
  place?: TransitWaypoint;
  streets?: string[];
}

export interface TransitBusSuggestionSelection {
  summary: string;
  pasos: TransitBusSuggestionSelectionStep[];
}

export interface TransitBusSuggestion {
  optionNumber?: number;
  title?: string;
  route: TransitRouteStreetsResponse['route'];
  shapeId: string;
  totalDistanceMeters: number;
  totalWalkMeters: number;
  busDistanceMeters: number;
  durationSeconds: number;
  walkDurationSeconds: number;
  busDurationSeconds: number;
  originWalkMeters: number;
  destinationWalkMeters: number;
  boardingPoint: TransitWaypoint;
  alightingPoint: TransitWaypoint;
  routeStreets: string[];
  directionConfidence: 'shape_order' | 'reverse_or_loop_unknown';
  steps: TransitBusSuggestionStep[];
  seleccion?: TransitBusSuggestionSelection;
  notes: string[];
}

export interface TransitBusSuggestionsResponse {
  puntoA: TransitWaypoint;
  puntoB: TransitWaypoint;
  rutasPosibles: TransitBusSuggestion[];
  origin: TransitWaypoint;
  destination: TransitWaypoint;
  searchRadiusMeters: number;
  suggestions: TransitBusSuggestion[];
  coverage: {
    hasSuggestions: boolean;
    note?: string;
  };
  generatedAtIso: string;
}

export type TransitTransmetroSuggestionStepType =
  | 'walk_to_stop'
  | 'board_feeder'
  | 'alight_transfer_station'
  | 'board_trunk'
  | 'alight_destination_station'
  | 'walk_to_destination';

export interface TransitTransmetroSuggestionStep {
  type: TransitTransmetroSuggestionStepType;
  instruction: string;
  distanceMeters?: number;
  durationSeconds?: number;
  serviceShortName?: string;
  serviceLongName?: string;
  from?: TransitWaypoint;
  to?: TransitWaypoint;
  place?: TransitWaypoint;
  streets?: string[];
}

export interface TransitTransmetroSuggestion {
  optionNumber: number;
  title: string;
  totalDistanceMeters: number;
  totalWalkMeters: number;
  transitDistanceMeters: number;
  durationSeconds: number;
  walkDurationSeconds: number;
  transitDurationSeconds: number;
  originWalkMeters: number;
  destinationWalkMeters: number;
  transferWalkMeters: number;
  feederService: TransitRouteStreetsResponse['route'];
  trunkService: TransitRouteStreetsResponse['route'];
  boardingStop: TransitWaypoint;
  transferStation: TransitWaypoint;
  destinationStation: TransitWaypoint;
  seleccion: {
    summary: string;
    pasos: TransitTransmetroSuggestionStep[];
  };
  notes: string[];
}

export interface TransitTransmetroSuggestionsResponse {
  puntoA: TransitWaypoint;
  puntoB: TransitWaypoint;
  seccion: 'transmetro';
  rutasPosibles: TransitTransmetroSuggestion[];
  searchRadiusMeters: number;
  coverage: {
    hasSuggestions: boolean;
    note?: string;
  };
  generatedAtIso: string;
}

export interface OtpPlanResponse {
  plan?: {
    itineraries?: Array<{
      duration: number;
      startTime?: number;
      endTime?: number;
      walkDistance?: number;
      legs?: Array<{
        mode: string;
        route?: string;
        routeId?: string;
        agencyName?: string;
        headsign?: string;
        distance?: number;
        duration?: number;
        from: { name?: string; lat: number; lon: number; stopId?: string };
        to: { name?: string; lat: number; lon: number; stopId?: string };
        legGeometry?: { points?: string };
      }>;
    }>;
  };
  error?: {
    msg?: string;
    message?: string;
  };
}
