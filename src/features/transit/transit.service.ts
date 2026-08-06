import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import {
  ACTIVE_STREAM_BUFFER_METERS,
  COLOMBIA_TIME_ZONE,
  DEFAULT_TRANSMETRO_EXPRESS_PEAK_HOURS,
  PHYSICAL_VALIDATION_RADIUS_METERS,
  TRANSMETRO_AVERAGE_METERS_PER_SECOND,
  TRANSMETRO_EXPRESS_ROUTE_CODES,
  TRANSMETRO_SHAPE_STOP_RADIUS_METERS,
  TRANSMETRO_STOP_SEARCH_RADIUS_METERS,
  TRANSMETRO_SUGGESTION_CANDIDATE_LIMIT,
  TRANSMETRO_SUGGESTION_LIMIT,
  TRANSIT_BUS_AVERAGE_METERS_PER_SECOND,
  TRANSIT_BUS_SUGGESTION_CANDIDATE_LIMIT,
  TRANSIT_BUS_SUGGESTION_LIMIT,
  TRANSIT_BUS_SUGGESTION_WALKING_RADIUS_METERS,
  TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS,
  TRANSIT_MAP_COLORS,
  TRANSIT_MAP_ROUTE_LIMIT,
  TRANSIT_MAP_STOP_LIMIT,
  TRANSIT_WALKING_AVERAGE_METERS_PER_SECOND,
} from '@/features/transit/transit.constants';
import type {
  TransitCommunityValidationDto,
  TransitCommunityValidationResult,
} from '@/features/transit/dto/transit-community-validation.dto';
import {
  TransitMode,
  TransitRouteRequestDto,
} from '@/features/transit/dto/transit-route-request.dto';
import type {
  OtpPlanResponse,
  TransitAlert,
  TransitBusSuggestion,
  TransitBusSuggestionSelection,
  TransitBusSuggestionSelectionStep,
  TransitBusSuggestionStep,
  TransitCoordinate,
  TransitItinerary,
  TransitLeg,
  TransitMapResponse,
  TransitMapRouteFeature,
  TransitMapStopFeature,
  TransitBusSuggestionsResponse,
  TransitTransmetroSuggestion,
  TransitTransmetroSuggestionStep,
  TransitTransmetroSuggestionsResponse,
  TransitRouteResponse,
  TransitRouteStreetsResponse,
  TransitWaypoint,
} from '@/features/transit/interfaces/transit-response.interface';
import type {
  ActiveStreamHit,
  OsrmWalkingResponse,
  PresenceValidationRow,
  TransitBusSuggestionRow,
  TransitMapRouteRow,
  TransitMapStopRow,
  TransitOperatingStatus,
  TransitRouteMetadata,
  TransitRouteStreetsRow,
  TransitTransmetroSuggestionRow,
  TransitWalkingEstimate,
} from '@/features/transit/interfaces/transit-query-row.interface';
import {
  TRANSIT_MAP_ROUTES_QUERY,
  TRANSIT_MAP_STOPS_QUERY,
} from '@/features/transit/queries/transit-map.query';
import { TRANSIT_ROUTE_STREETS_QUERY } from '@/features/transit/queries/transit-route-streets.query';
import { TRANSIT_BUS_SUGGESTIONS_QUERY } from '@/features/transit/queries/transit-bus-suggestions.query';
import { TRANSMETRO_SUGGESTIONS_QUERY } from '@/features/transit/queries/transmetro-suggestions.query';

@Injectable()
export class TransitService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    private readonly dataSource: DataSource,
  ) {}

  async calculateItineraries(
    routeRequest: TransitRouteRequestDto,
  ): Promise<TransitRouteResponse> {
    this.assertSupportedMode(routeRequest.mode);
    const otpPayload = await this.fetchOtpPlan(routeRequest);
    const rawItineraries = otpPayload.plan?.itineraries ?? [];

    if (rawItineraries.length === 0) {
      throw new ServiceUnavailableException(
        otpPayload.error?.msg ??
          otpPayload.error?.message ??
          'OTP no devolvio itinerarios.',
      );
    }

    const assessed = await Promise.all(
      rawItineraries.map(async (itinerary, index) => {
        const mapped = this.toTransitItinerary(itinerary, index, routeRequest);
        const alerts = await this.getActiveStreamAlerts(mapped);
        return {
          itinerary: {
            ...mapped,
            alerts,
            riskStatus:
              alerts.length > 0 ? ('blocked' as const) : ('clear' as const),
          },
          hasRisk: alerts.length > 0,
        };
      }),
    );
    const safe = assessed.find((candidate) => !candidate.hasRisk)?.itinerary;
    const selected = safe ?? assessed[0].itinerary;
    const rerouted = assessed[0].itinerary.id !== selected.id;
    const riskStatus = rerouted ? 'rerouted' : selected.riskStatus;

    return {
      itineraries: [
        {
          ...selected,
          riskStatus,
          recalculatedForRisk: rerouted,
        },
      ],
      sourceSnapshots: [
        {
          id: 'quilla-gtfs',
          kind: 'manual_override',
          version: this.getSourceVersion(),
          fetchedAtIso: new Date().toISOString(),
          notes:
            'Runtime GTFS consolidado desde fuentes oficiales, OSM y overrides QuillaMap.',
        },
      ],
      generatedAtIso: new Date().toISOString(),
    };
  }

  async validateRoutePresence(
    validationRequest: TransitCommunityValidationDto,
  ): Promise<TransitCommunityValidationResult> {
    if (validationRequest.accuracyMeters > PHYSICAL_VALIDATION_RADIUS_METERS) {
      return {
        accepted: false,
        reason: 'GPS accuracy is too low for physical route validation.',
      };
    }

    const rows = await this.reportRepository.query<PresenceValidationRow[]>(
      `
      select id,
        ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance_meters
      from transit_stops
      where route_id = $3
      and ($4::text is null or id = $4)
      and ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $5
      )
      order by distance_meters asc
      limit 1
      `,
      [
        validationRequest.longitude,
        validationRequest.latitude,
        validationRequest.routeId,
        validationRequest.stopId ?? null,
        PHYSICAL_VALIDATION_RADIUS_METERS,
      ],
    );
    const nearest = rows[0];

    if (!nearest) {
      return {
        accepted: false,
        reason:
          'No hay presencia fisica server-side cerca de la ruta o paradero.',
      };
    }

    return {
      accepted: true,
      serverDistanceMeters: Number(nearest.distance_meters),
    };
  }

  async getTransitMap(): Promise<TransitMapResponse> {
    const [routeRows, stopRows] = await Promise.all([
      this.dataSource.query<TransitMapRouteRow[]>(TRANSIT_MAP_ROUTES_QUERY, [
        TRANSIT_MAP_ROUTE_LIMIT,
      ]),
      this.dataSource.query<TransitMapStopRow[]>(TRANSIT_MAP_STOPS_QUERY, [
        TRANSIT_MAP_STOP_LIMIT,
      ]),
    ]);

    const routeFeatures = routeRows.flatMap((row): TransitMapRouteFeature[] => {
      if (
        row.geometry?.type !== 'LineString' ||
        row.geometry.coordinates.length < 3
      ) {
        return [];
      }

      const color = this.getTransitMapColor(row.agency_kind, row.source_kind);
      const operatingStatus = this.getTransitOperatingStatus(
        row.route_metadata,
        new Date(),
        row.short_name,
      );
      return [
        {
          type: 'Feature',
          id: row.id,
          properties: {
            id: row.id,
            kind: 'route',
            routeId: row.route_id,
            shortName: row.short_name,
            longName: row.long_name ?? undefined,
            agencyKind: row.agency_kind,
            sourceKind: row.source_kind,
            operatorName: row.operator_name ?? undefined,
            streets: row.streets ?? [],
            ...operatingStatus,
            color,
          },
          geometry: row.geometry,
        },
      ];
    });

    const stopFeatures = stopRows.flatMap((row): TransitMapStopFeature[] => {
      if (
        row.geometry?.type !== 'Point' ||
        row.geometry.coordinates.length < 2
      ) {
        return [];
      }

      const color = this.getTransitMapColor(row.agency_kind, row.source_kind);
      return [
        {
          type: 'Feature',
          id: row.id,
          properties: {
            id: row.id,
            kind: 'stop',
            routeId: row.route_id ?? undefined,
            name: row.name,
            agencyKind: row.agency_kind,
            sourceKind: row.source_kind,
            color,
          },
          geometry: row.geometry,
        },
      ];
    });

    return {
      type: 'FeatureCollection',
      features: [...routeFeatures, ...stopFeatures],
      generatedAtIso: new Date().toISOString(),
    };
  }

  async getTransitRouteStreets(
    routeKey: string,
  ): Promise<TransitRouteStreetsResponse> {
    const normalizedRouteKey = routeKey.trim();
    if (!normalizedRouteKey) {
      throw new BadRequestException(
        'Debes enviar el id o shortName de la ruta.',
      );
    }

    const rows = await this.dataSource.query<TransitRouteStreetsRow[]>(
      TRANSIT_ROUTE_STREETS_QUERY,
      [normalizedRouteKey],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`No encontre la ruta ${normalizedRouteKey}.`);
    }

    const routeRow = rows[0];
    const operatingStatus = this.getTransitOperatingStatus(
      routeRow.route_metadata,
      new Date(),
      routeRow.short_name,
    );
    const directions = rows
      .filter((row) => row.shape_id)
      .map((row) => {
        const streets = this.uniqueOrdered(
          this.toStringArray(row.shape_metadata?.streets),
        );

        return {
          shapeId: row.shape_id as string,
          sourceKind: row.shape_source_kind ?? routeRow.route_source_kind,
          directionLabel:
            row.shape_metadata?.directionLabel ?? row.shape_metadata?.direction,
          geometryStatus: row.shape_metadata?.geometryStatus,
          streets,
          coordinatesCount: Number(row.coordinates_count ?? 0),
        };
      });
    const streets = this.uniqueOrdered(
      directions.flatMap((direction) => direction.streets),
    );
    const hasGeometry = directions.length > 0;
    const hasStreetSequence = streets.length > 0;
    const hasDirectionSplit = directions.some((direction) =>
      Boolean(direction.directionLabel),
    );

    return {
      route: {
        id: routeRow.route_id,
        shortName: routeRow.short_name,
        longName: routeRow.long_name ?? undefined,
        agencyKind: routeRow.agency_kind,
        operatorName: routeRow.operator_name ?? undefined,
        sourceKind: routeRow.route_source_kind,
        ...operatingStatus,
      },
      streets,
      directions,
      coverage: {
        hasGeometry,
        hasStreetSequence,
        directionSplit: hasDirectionSplit ? 'available' : 'not_available',
        note: this.getTransitRouteStreetsCoverageNote(
          hasGeometry,
          hasStreetSequence,
          hasDirectionSplit,
        ),
      },
      generatedAtIso: new Date().toISOString(),
    };
  }

  async getTransitBusSuggestions(
    routeRequest: TransitRouteRequestDto,
  ): Promise<TransitBusSuggestionsResponse> {
    this.assertSupportedMode(routeRequest.mode);
    const rows = await this.dataSource.query<TransitBusSuggestionRow[]>(
      TRANSIT_BUS_SUGGESTIONS_QUERY,
      [
        routeRequest.origin.longitude,
        routeRequest.origin.latitude,
        routeRequest.destination.longitude,
        routeRequest.destination.latitude,
        TRANSIT_BUS_SUGGESTION_WALKING_RADIUS_METERS,
        TRANSIT_BUS_SUGGESTION_CANDIDATE_LIMIT,
      ],
    );

    const walkingEstimateCache = new Map<
      string,
      Promise<TransitWalkingEstimate>
    >();
    const suggestions = await Promise.all(
      rows.map((row) =>
        this.toTransitBusSuggestion(row, routeRequest, walkingEstimateCache),
      ),
    );
    const sortedSuggestions = suggestions
      .sort(
        (left, right) =>
          left.durationSeconds - right.durationSeconds ||
          left.totalDistanceMeters - right.totalDistanceMeters,
      )
      .slice(0, TRANSIT_BUS_SUGGESTION_LIMIT)
      .map((suggestion, index) =>
        this.withTransitBusSuggestionPresentation(
          suggestion,
          routeRequest,
          index + 1,
        ),
      );

    return {
      puntoA: routeRequest.origin,
      puntoB: routeRequest.destination,
      rutasPosibles: sortedSuggestions,
      origin: routeRequest.origin,
      destination: routeRequest.destination,
      searchRadiusMeters: TRANSIT_BUS_SUGGESTION_WALKING_RADIUS_METERS,
      suggestions: sortedSuggestions,
      coverage: {
        hasSuggestions: sortedSuggestions.length > 0,
        note:
          sortedSuggestions.length > 0
            ? 'Opciones calculadas con rutas inyectadas y tiempos de caminata por OSRM cuando esta disponible.'
            : 'No encontre una ruta directa cuya geometria pase cerca del origen y del destino dentro del radio configurado.',
      },
      generatedAtIso: new Date().toISOString(),
    };
  }

  async getTransmetroSuggestions(
    routeRequest: TransitRouteRequestDto,
  ): Promise<TransitTransmetroSuggestionsResponse> {
    this.assertSupportedMode(routeRequest.mode);
    const rows = await this.dataSource.query<TransitTransmetroSuggestionRow[]>(
      TRANSMETRO_SUGGESTIONS_QUERY,
      [
        routeRequest.origin.longitude,
        routeRequest.origin.latitude,
        routeRequest.destination.longitude,
        routeRequest.destination.latitude,
        TRANSMETRO_SHAPE_STOP_RADIUS_METERS,
        TRANSMETRO_STOP_SEARCH_RADIUS_METERS,
        TRANSMETRO_SUGGESTION_CANDIDATE_LIMIT,
      ],
    );

    const walkingEstimateCache = new Map<
      string,
      Promise<TransitWalkingEstimate>
    >();
    const suggestions = await Promise.all(
      rows.map((row) =>
        this.toTransmetroSuggestion(row, routeRequest, walkingEstimateCache),
      ),
    );
    const sortedSuggestions = suggestions
      .filter(
        (suggestion) =>
          suggestion.feederService.isCurrentlyOperating &&
          suggestion.trunkService.isCurrentlyOperating,
      )
      .sort(
        (left, right) =>
          this.getTransmetroSuggestionPreferenceScore(left, routeRequest) -
            this.getTransmetroSuggestionPreferenceScore(right, routeRequest) ||
          left.durationSeconds - right.durationSeconds ||
          left.totalDistanceMeters - right.totalDistanceMeters,
      )
      .slice(0, TRANSMETRO_SUGGESTION_LIMIT)
      .map((suggestion, index) => ({
        ...suggestion,
        optionNumber: index + 1,
        title: `Opcion ${index + 1}: ${suggestion.feederService.shortName} + ${suggestion.trunkService.shortName}`,
      }));

    return {
      puntoA: routeRequest.origin,
      puntoB: routeRequest.destination,
      seccion: 'transmetro',
      rutasPosibles: sortedSuggestions,
      searchRadiusMeters: TRANSMETRO_STOP_SEARCH_RADIUS_METERS,
      coverage: {
        hasSuggestions: sortedSuggestions.length > 0,
        note:
          sortedSuggestions.length > 0
            ? 'Opciones calculadas con servicios y paraderos/estaciones Transmetro inyectados.'
            : 'No encontre una combinacion Transmetro con paraderos/estaciones cerca del origen y destino dentro del radio configurado.',
      },
      generatedAtIso: new Date().toISOString(),
    };
  }

  private async fetchOtpPlan(
    routeRequest: TransitRouteRequestDto,
  ): Promise<OtpPlanResponse> {
    const response = await fetch(this.getOtpPlanUrl(routeRequest));
    const payload = (await response.json()) as OtpPlanResponse;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error?.msg ??
          payload.error?.message ??
          'OTP no esta disponible.',
      );
    }

    return payload;
  }

  private async toTransitBusSuggestion(
    row: TransitBusSuggestionRow,
    routeRequest: TransitRouteRequestDto,
    walkingEstimateCache?: Map<string, Promise<TransitWalkingEstimate>>,
  ): Promise<TransitBusSuggestion> {
    const operatingStatus = this.getTransitOperatingStatus(
      row.route_metadata,
      this.getRouteRequestDate(routeRequest),
      row.short_name,
    );
    const boardingPoint = this.toTransitWaypoint(
      row.boarding_point,
      `Subir a ${row.short_name}`,
    );
    const alightingPoint = this.toTransitWaypoint(
      row.alighting_point,
      `Bajarse de ${row.short_name}`,
    );
    const originWalk = await this.getWalkingLegEstimate(
      routeRequest.origin,
      boardingPoint,
      Number(row.origin_walk_meters),
      walkingEstimateCache,
    );
    const destinationWalk = await this.getWalkingLegEstimate(
      alightingPoint,
      routeRequest.destination,
      Number(row.destination_walk_meters),
      walkingEstimateCache,
    );
    const busDistanceMeters = Number(row.bus_distance_meters);
    const busDurationSeconds = Math.round(
      busDistanceMeters / TRANSIT_BUS_AVERAGE_METERS_PER_SECOND,
    );
    const walkDurationSeconds =
      originWalk.durationSeconds + destinationWalk.durationSeconds;
    const totalWalkMeters =
      originWalk.distanceMeters + destinationWalk.distanceMeters;
    const streets = this.uniqueOrdered(
      this.toStringArray(row.shape_metadata?.streets),
    );
    const directionConfidence =
      Number(row.destination_fraction) >= Number(row.origin_fraction)
        ? 'shape_order'
        : 'reverse_or_loop_unknown';
    const routeNote =
      streets.length > 0
        ? undefined
        : 'La fuente de esta ruta tiene geometria, pero no trae nombres de calles/carreras para el tramo de bus.';
    const directionNote =
      directionConfidence === 'shape_order'
        ? undefined
        : 'La geometria no confirma sentido ida/vuelta; se usa como ruta directa por cercania a origen y destino.';
    const includeOriginWalk =
      originWalk.distanceMeters > TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS;
    const includeDestinationWalk =
      destinationWalk.distanceMeters > TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS;
    const steps: TransitBusSuggestionStep[] = [];

    if (includeOriginWalk) {
      steps.push({
        type: 'walk_to_boarding',
        instruction: this.getWalkingInstruction(
          `Camina hasta el punto mas cercano para tomar ${row.short_name}.`,
          originWalk.streets,
        ),
        distanceMeters: originWalk.distanceMeters,
        from: routeRequest.origin,
        to: boardingPoint,
        streets: originWalk.streets,
      });
    }

    steps.push({
      type: 'bus' as const,
      instruction: this.getBusInstruction(
        row.short_name,
        row.operator_name,
        includeOriginWalk,
        includeDestinationWalk,
      ),
      distanceMeters: busDistanceMeters,
      routeShortName: row.short_name,
      operatorName: row.operator_name ?? undefined,
      from: includeOriginWalk ? boardingPoint : routeRequest.origin,
      to: includeDestinationWalk ? alightingPoint : routeRequest.destination,
      streets,
    });

    if (includeDestinationWalk) {
      steps.push({
        type: 'walk_to_destination',
        instruction: this.getWalkingInstruction(
          'Camina desde el punto de bajada hasta tu destino.',
          destinationWalk.streets,
        ),
        distanceMeters: destinationWalk.distanceMeters,
        from: alightingPoint,
        to: routeRequest.destination,
        streets: destinationWalk.streets,
      });
    }

    return {
      route: {
        id: row.route_id,
        shortName: row.short_name,
        longName: row.long_name ?? undefined,
        agencyKind: row.agency_kind,
        operatorName: row.operator_name ?? undefined,
        sourceKind: row.route_source_kind,
        ...operatingStatus,
      },
      shapeId: row.shape_id,
      totalDistanceMeters: totalWalkMeters + busDistanceMeters,
      totalWalkMeters,
      busDistanceMeters,
      durationSeconds: walkDurationSeconds + busDurationSeconds,
      walkDurationSeconds,
      busDurationSeconds,
      originWalkMeters: originWalk.distanceMeters,
      destinationWalkMeters: destinationWalk.distanceMeters,
      boardingPoint,
      alightingPoint,
      routeStreets: streets,
      directionConfidence,
      steps,
      notes: [routeNote, directionNote].filter((note): note is string =>
        Boolean(note),
      ),
    };
  }

  private withTransitBusSuggestionPresentation(
    suggestion: TransitBusSuggestion,
    routeRequest: TransitRouteRequestDto,
    optionNumber: number,
  ): TransitBusSuggestion {
    const title = `Opcion ${optionNumber}: ${suggestion.route.shortName}${suggestion.route.operatorName ? ` - ${suggestion.route.operatorName}` : ''}`;

    return {
      ...suggestion,
      optionNumber,
      title,
      seleccion: this.getTransitBusSuggestionSelection(
        suggestion,
        routeRequest,
      ),
    };
  }

  private getTransitBusSuggestionSelection(
    suggestion: TransitBusSuggestion,
    routeRequest: TransitRouteRequestDto,
  ): TransitBusSuggestionSelection {
    const includeOriginWalk =
      suggestion.originWalkMeters > TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS;
    const includeDestinationWalk =
      suggestion.destinationWalkMeters > TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS;
    const routeName = suggestion.route.shortName;
    const operatorName = suggestion.route.operatorName;
    const boardPlace = includeOriginWalk
      ? suggestion.boardingPoint
      : routeRequest.origin;
    const alightPlace = includeDestinationWalk
      ? suggestion.alightingPoint
      : routeRequest.destination;
    const walkToBoardingStep = suggestion.steps.find(
      (step) => step.type === 'walk_to_boarding',
    );
    const walkToDestinationStep = suggestion.steps.find(
      (step) => step.type === 'walk_to_destination',
    );

    const pasos: TransitBusSuggestionSelectionStep[] = [];

    if (includeOriginWalk) {
      pasos.push({
        type: 'walk_to_boarding',
        instruction: this.getWalkingInstruction(
          `Camina hasta ${this.getWaypointDisplay(suggestion.boardingPoint)}.`,
          walkToBoardingStep?.streets ?? [],
        ),
        distanceMeters: suggestion.originWalkMeters,
        from: routeRequest.origin,
        to: suggestion.boardingPoint,
        streets: walkToBoardingStep?.streets ?? [],
      });
    }

    pasos.push({
      type: 'board_bus',
      instruction: includeOriginWalk
        ? `Coge el bus ${routeName}${operatorName ? ` de ${operatorName}` : ''} ahi.`
        : `Coge el bus ${routeName}${operatorName ? ` de ${operatorName}` : ''} en el Punto A; la ruta pasa por tu ubicacion.`,
      place: boardPlace,
    });

    pasos.push({
      type: 'alight_bus',
      instruction: includeDestinationWalk
        ? `Bajate en ${this.getWaypointDisplay(suggestion.alightingPoint)}.`
        : `Bajate en el Punto B; esta opcion te deja practicamente en la puerta.`,
      place: alightPlace,
    });

    if (includeDestinationWalk) {
      pasos.push({
        type: 'walk_to_destination',
        instruction: this.getWalkingInstruction(
          `Camina hasta ${this.getWaypointDisplay(routeRequest.destination)}.`,
          walkToDestinationStep?.streets ?? [],
        ),
        distanceMeters: suggestion.destinationWalkMeters,
        from: suggestion.alightingPoint,
        to: routeRequest.destination,
        streets: walkToDestinationStep?.streets ?? [],
      });
    }

    return {
      summary: `${routeName}${operatorName ? ` de ${operatorName}` : ''}: ${Math.round(suggestion.durationSeconds / 60)} min aprox, ${(suggestion.totalDistanceMeters / 1_000).toFixed(2)} km.`,
      pasos,
    };
  }

  private async toTransmetroSuggestion(
    row: TransitTransmetroSuggestionRow,
    routeRequest: TransitRouteRequestDto,
    walkingEstimateCache?: Map<string, Promise<TransitWalkingEstimate>>,
  ): Promise<TransitTransmetroSuggestion> {
    const operatingDate = this.getRouteRequestDate(routeRequest);
    const feederOperatingStatus = this.getTransitOperatingStatus(
      row.feeder_route_metadata,
      operatingDate,
      row.feeder_short_name,
    );
    const trunkOperatingStatus = this.getTransitOperatingStatus(
      row.trunk_route_metadata,
      operatingDate,
      row.trunk_short_name,
    );
    const boardingStop = this.toTransitWaypoint(
      row.boarding_stop_point,
      row.boarding_stop_name,
    );
    const transferStation = this.toTransitWaypoint(
      row.transfer_stop_point,
      row.transfer_stop_name,
    );
    const destinationStation = this.toTransitWaypoint(
      row.destination_stop_point,
      row.destination_stop_name,
    );
    const originWalk = await this.getWalkingLegEstimate(
      routeRequest.origin,
      boardingStop,
      Number(row.origin_walk_meters),
      walkingEstimateCache,
    );
    const destinationWalk = await this.getWalkingLegEstimate(
      destinationStation,
      routeRequest.destination,
      Number(row.destination_walk_meters),
      walkingEstimateCache,
    );
    const transferWalkMeters = 0;
    const feederDistanceMeters = Number(row.feeder_distance_meters);
    const trunkDistanceMeters = Number(row.trunk_distance_meters);
    const transitDistanceMeters = feederDistanceMeters + trunkDistanceMeters;
    const transitDurationSeconds = Math.round(
      transitDistanceMeters / TRANSMETRO_AVERAGE_METERS_PER_SECOND,
    );
    const walkDurationSeconds =
      originWalk.durationSeconds + destinationWalk.durationSeconds;
    const totalWalkMeters =
      originWalk.distanceMeters +
      destinationWalk.distanceMeters +
      transferWalkMeters;
    const includeOriginWalk =
      originWalk.distanceMeters > TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS;
    const includeDestinationWalk =
      destinationWalk.distanceMeters > TRANSIT_DIRECT_ACCESS_THRESHOLD_METERS;
    const steps: TransitTransmetroSuggestionStep[] = [];

    if (includeOriginWalk) {
      steps.push({
        type: 'walk_to_stop',
        instruction: this.getWalkingInstruction(
          `Camina al paradero ${boardingStop.label ?? row.boarding_stop_name}.`,
          originWalk.streets,
        ),
        distanceMeters: originWalk.distanceMeters,
        durationSeconds: originWalk.durationSeconds,
        from: routeRequest.origin,
        to: boardingStop,
        streets: originWalk.streets,
      });
    }

    steps.push({
      type: 'board_feeder',
      instruction: includeOriginWalk
        ? `Coge el servicio ${row.feeder_short_name} ahi.`
        : `Coge el servicio ${row.feeder_short_name} en el Punto A; el paradero esta practicamente encima de tu ubicacion.`,
      serviceShortName: row.feeder_short_name,
      serviceLongName: row.feeder_long_name ?? undefined,
      place: includeOriginWalk ? boardingStop : routeRequest.origin,
    });

    steps.push({
      type: 'alight_transfer_station',
      instruction: `Bajate en ${transferStation.label ?? row.transfer_stop_name}.`,
      serviceShortName: row.feeder_short_name,
      serviceLongName: row.feeder_long_name ?? undefined,
      place: transferStation,
    });

    steps.push({
      type: 'board_trunk',
      instruction: `Coge el servicio ${row.trunk_short_name} en ${transferStation.label ?? row.transfer_stop_name}.`,
      serviceShortName: row.trunk_short_name,
      serviceLongName: row.trunk_long_name ?? undefined,
      place: transferStation,
    });

    steps.push({
      type: 'alight_destination_station',
      instruction: includeDestinationWalk
        ? `Bajate en ${destinationStation.label ?? row.destination_stop_name}.`
        : `Bajate en el Punto B; esta opcion te deja practicamente en la puerta.`,
      serviceShortName: row.trunk_short_name,
      serviceLongName: row.trunk_long_name ?? undefined,
      place: includeDestinationWalk
        ? destinationStation
        : routeRequest.destination,
    });

    if (includeDestinationWalk) {
      steps.push({
        type: 'walk_to_destination',
        instruction: this.getWalkingInstruction(
          `Camina hasta ${this.getWaypointDisplay(routeRequest.destination)}.`,
          destinationWalk.streets,
        ),
        distanceMeters: destinationWalk.distanceMeters,
        durationSeconds: destinationWalk.durationSeconds,
        from: destinationStation,
        to: routeRequest.destination,
        streets: destinationWalk.streets,
      });
    }

    return {
      optionNumber: 0,
      title: '',
      totalDistanceMeters: totalWalkMeters + transitDistanceMeters,
      totalWalkMeters,
      transitDistanceMeters,
      durationSeconds: walkDurationSeconds + transitDurationSeconds,
      walkDurationSeconds,
      transitDurationSeconds,
      originWalkMeters: originWalk.distanceMeters,
      destinationWalkMeters: destinationWalk.distanceMeters,
      transferWalkMeters,
      feederService: {
        id: row.feeder_route_id,
        shortName: row.feeder_short_name,
        longName: row.feeder_long_name ?? undefined,
        agencyKind: 'transmetro',
        operatorName: row.feeder_operator_name ?? undefined,
        sourceKind: row.feeder_source_kind,
        ...feederOperatingStatus,
      },
      trunkService: {
        id: row.trunk_route_id,
        shortName: row.trunk_short_name,
        longName: row.trunk_long_name ?? undefined,
        agencyKind: 'transmetro',
        operatorName: row.trunk_operator_name ?? undefined,
        sourceKind: row.trunk_source_kind,
        ...trunkOperatingStatus,
      },
      boardingStop,
      transferStation,
      destinationStation,
      seleccion: {
        summary: `${row.feeder_short_name} + ${row.trunk_short_name}: ${Math.round((walkDurationSeconds + transitDurationSeconds) / 60)} min aprox, ${((totalWalkMeters + transitDistanceMeters) / 1_000).toFixed(2)} km.`,
        pasos: steps,
      },
      notes: [
        'Transmetro se calcula por paraderos/estaciones inyectados; las instrucciones usan nombres reales de paradas cuando existen en la BD.',
      ],
    };
  }

  private getTransmetroSuggestionPreferenceScore(
    suggestion: TransitTransmetroSuggestion,
    routeRequest: TransitRouteRequestDto,
  ): number {
    const originLabel = this.normalizeText(routeRequest.origin.label ?? '');
    const feederText = this.normalizeText(
      [
        suggestion.feederService.shortName,
        suggestion.feederService.longName,
        suggestion.feederService.operatorName,
      ]
        .filter(Boolean)
        .join(' '),
    );
    const originWords = originLabel
      .split(/\s+/)
      .filter((word) => word.length >= 5);
    const matchesOriginName = originWords.some((word) =>
      feederText.includes(word),
    );
    const trunkName = suggestion.trunkService.shortName;
    const isVerboseDirectionalBus =
      trunkName.toLowerCase().startsWith('bus ') || trunkName.includes(':');

    return (
      (matchesOriginName ? -1_000 : 0) +
      (isVerboseDirectionalBus ? 100 : 0) +
      Math.round(suggestion.originWalkMeters / 25)
    );
  }

  private async getWalkingLegEstimate(
    from: TransitWaypoint,
    to: TransitWaypoint,
    fallbackDistanceMeters: number,
    cache?: Map<string, Promise<TransitWalkingEstimate>>,
  ): Promise<TransitWalkingEstimate> {
    const cacheKey = this.getWalkingEstimateCacheKey(from, to);

    if (cache?.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const estimatePromise = this.resolveWalkingLegEstimate(
      from,
      to,
      fallbackDistanceMeters,
    );
    cache?.set(cacheKey, estimatePromise);

    return estimatePromise;
  }

  private async resolveWalkingLegEstimate(
    from: TransitWaypoint,
    to: TransitWaypoint,
    fallbackDistanceMeters: number,
  ): Promise<TransitWalkingEstimate> {
    const osrmEstimate = await this.fetchOsrmWalkingRoute(from, to);

    if (osrmEstimate) {
      return osrmEstimate;
    }

    return {
      distanceMeters: Math.round(fallbackDistanceMeters),
      durationSeconds: Math.round(
        fallbackDistanceMeters / TRANSIT_WALKING_AVERAGE_METERS_PER_SECOND,
      ),
      streets: [],
    };
  }

  private async fetchOsrmWalkingRoute(
    from: TransitWaypoint,
    to: TransitWaypoint,
  ): Promise<TransitWalkingEstimate | null> {
    for (const baseUrl of this.getOsrmWalkingBaseUrls()) {
      try {
        const response = await fetch(this.getOsrmWalkingUrl(baseUrl, from, to));
        const payload = (await response.json()) as OsrmWalkingResponse;
        const route = payload.routes?.[0];

        if (response.ok && payload.code === 'Ok' && route) {
          return {
            distanceMeters: Math.round(route.distance),
            durationSeconds: Math.round(route.duration),
            streets: this.getOsrmStepStreets(route),
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private getWalkingEstimateCacheKey(
    from: TransitWaypoint,
    to: TransitWaypoint,
  ): string {
    return [
      from.latitude.toFixed(6),
      from.longitude.toFixed(6),
      to.latitude.toFixed(6),
      to.longitude.toFixed(6),
    ].join(',');
  }

  private getOsrmStepStreets(
    route: NonNullable<OsrmWalkingResponse['routes']>[number],
  ): string[] {
    const names = route.legs
      ?.flatMap((leg) => leg.steps ?? [])
      .map((step) => step.name || step.ref)
      .filter((name): name is string => Boolean(name?.trim()));

    return this.uniqueOrdered(names ?? []);
  }

  private getWalkingInstruction(
    baseInstruction: string,
    streets: string[],
  ): string {
    if (streets.length === 0) {
      return baseInstruction;
    }

    return `${baseInstruction} Calles de caminata: ${streets.join(' -> ')}.`;
  }

  private getBusInstruction(
    shortName: string,
    operatorName: string | null,
    includeOriginWalk: boolean,
    includeDestinationWalk: boolean,
  ): string {
    const busName = `${shortName}${operatorName ? ` de ${operatorName}` : ''}`;
    const boardInstruction = includeOriginWalk
      ? `Toma ${busName} en el punto indicado`
      : `Toma ${busName} en tu ubicacion`;
    const alightInstruction = includeDestinationWalk
      ? 'bajate cerca del destino'
      : 'bajate en el destino';

    return `${boardInstruction} y ${alightInstruction}.`;
  }

  private getWaypointDisplay(point: TransitWaypoint): string {
    const label = this.getHumanWaypointLabel(point.label);

    return `${label} (${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)})`;
  }

  private getHumanWaypointLabel(label?: string): string {
    if (!label) {
      return 'el punto indicado';
    }

    if (label.startsWith('Subir a ')) {
      return `el punto para coger ${label.replace('Subir a ', '')}`;
    }

    if (label.startsWith('Bajarse de ')) {
      return `el punto de bajada de ${label.replace('Bajarse de ', '')}`;
    }

    return label;
  }

  private getOsrmWalkingBaseUrls(): string[] {
    return this.uniqueOrdered(
      [
        this.configService.get<string>('OSRM_WALKING_BASE_URL') ?? '',
        'http://host.docker.internal:5001',
        'http://localhost:5001',
      ].filter(Boolean),
    );
  }

  private getOsrmWalkingUrl(
    baseUrl: string,
    from: TransitWaypoint,
    to: TransitWaypoint,
  ): string {
    const origin = `${from.longitude},${from.latitude}`;
    const destination = `${to.longitude},${to.latitude}`;
    return `${baseUrl}/route/v1/walking/${origin};${destination}?overview=false&steps=true&alternatives=false`;
  }

  private getOtpPlanUrl(routeRequest: TransitRouteRequestDto): string {
    const baseUrl =
      this.configService.get<string>('OTP_PLAN_BASE_URL') ??
      'http://localhost:8080/otp/routers/default/plan';
    const params = new URLSearchParams({
      fromPlace: `${routeRequest.origin.latitude},${routeRequest.origin.longitude}`,
      toPlace: `${routeRequest.destination.latitude},${routeRequest.destination.longitude}`,
      mode: 'TRANSIT,WALK',
      numItineraries: '3',
      locale: 'es',
    });

    if (routeRequest.departureIso) {
      const departure = new Date(routeRequest.departureIso);
      params.set('date', departure.toISOString().slice(0, 10));
      params.set('time', departure.toISOString().slice(11, 19));
    }

    return `${baseUrl}?${params.toString()}`;
  }

  private toTransitItinerary(
    otpItinerary: NonNullable<
      NonNullable<OtpPlanResponse['plan']>['itineraries']
    >[number],
    index: number,
    routeRequest: TransitRouteRequestDto,
  ): TransitItinerary {
    const legs = (otpItinerary.legs ?? []).map((leg, legIndex) =>
      this.toTransitLeg(leg, legIndex),
    );
    const durationSeconds = Math.round(
      otpItinerary.duration ?? this.sum(legs.map((leg) => leg.durationSeconds)),
    );
    const distanceMeters = Math.round(
      this.sum(legs.map((leg) => leg.distanceMeters)),
    );

    return {
      id: `otp-itinerary-${index}`,
      mode: routeRequest.mode,
      legs,
      alerts: [],
      riskStatus: 'clear',
      distanceMeters,
      durationSeconds,
      transfers: this.countTransfers(legs),
      sourceVersion: this.getSourceVersion(),
      recalculatedForRisk: false,
      etaIso: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    };
  }

  private toTransitLeg(
    leg: NonNullable<
      NonNullable<
        NonNullable<OtpPlanResponse['plan']>['itineraries']
      >[number]['legs']
    >[number],
    index: number,
  ): TransitLeg {
    const from = this.toWaypoint(leg.from);
    const to = this.toWaypoint(leg.to);
    const geometry = this.getLegGeometry(leg.legGeometry?.points, from, to);
    const type = this.toLegType(leg.mode);

    return {
      id: `otp-leg-${index}`,
      type,
      geometry,
      distanceMeters: Math.round(leg.distance ?? 0),
      durationSeconds: Math.round(leg.duration ?? 0),
      from,
      to,
      routeId: leg.routeId,
      routeShortName: leg.route,
      agencyKind: this.toAgencyKind(leg.agencyName),
      stopId: leg.from.stopId ?? leg.to.stopId,
      headsign: leg.headsign,
    };
  }

  private async getActiveStreamAlerts(
    itinerary: TransitItinerary,
  ): Promise<TransitAlert[]> {
    const rows = await Promise.all(
      itinerary.legs.map((leg) => this.findActiveStreams(leg.geometry)),
    );
    return rows.flat().map((stream) => ({
      id: stream.id,
      type: 'active_stream',
      severity: 'danger',
      title: 'Arroyo activo en el itinerario',
      description: stream.description ?? undefined,
    }));
  }

  private async findActiveStreams(
    geometry: TransitCoordinate[],
  ): Promise<ActiveStreamHit[]> {
    if (geometry.length < 2) {
      return [];
    }

    return this.reportRepository.query<ActiveStreamHit[]>(
      `
      select id, description
      from report
      where type = $1
      and status = $2
      and ST_DWithin(
        location,
        ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography,
        $4
      )
      `,
      [
        ReportType.ARROYO,
        ReportStatus.ACTIVO,
        JSON.stringify(this.toLineString(geometry)),
        ACTIVE_STREAM_BUFFER_METERS,
      ],
    );
  }

  private getLegGeometry(
    encodedGeometry: string | undefined,
    from: TransitWaypoint,
    to: TransitWaypoint,
  ): TransitCoordinate[] {
    if (!encodedGeometry) {
      return [from, to];
    }

    const decoded = this.decodePolyline(encodedGeometry, 5);
    return decoded.length > 1 ? decoded : [from, to];
  }

  private decodePolyline(shape: string, precision = 5): TransitCoordinate[] {
    const factor = 10 ** precision;
    const coordinates: TransitCoordinate[] = [];
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
      coordinates.push({
        latitude: latitude / factor,
        longitude: longitude / factor,
      });
    }

    return coordinates;
  }

  private decodeChunk(
    shape: string,
    startIndex: number,
  ): { delta: number; nextIndex: number } {
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

    return {
      delta: result & 1 ? ~(result >> 1) : result >> 1,
      nextIndex: index,
    };
  }

  private toWaypoint(point: {
    name?: string;
    lat: number;
    lon: number;
  }): TransitWaypoint {
    return {
      latitude: point.lat,
      longitude: point.lon,
      label: point.name,
    };
  }

  private toTransitWaypoint(
    point: { coordinates: [number, number] },
    label: string,
  ): TransitWaypoint {
    return {
      latitude: point.coordinates[1],
      longitude: point.coordinates[0],
      label,
    };
  }

  private toLegType(mode: string): TransitLeg['type'] {
    if (mode.toUpperCase() === 'WALK') return 'walk';
    return mode.toUpperCase() === 'BUS' ? 'bus' : 'transfer';
  }

  private toAgencyKind(
    agencyName: string | undefined,
  ): TransitLeg['agencyKind'] {
    return agencyName?.toLowerCase().includes('transmetro')
      ? 'transmetro'
      : 'colectivo';
  }

  private countTransfers(legs: TransitLeg[]): number {
    return Math.max(0, legs.filter((leg) => leg.type === 'bus').length - 1);
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private uniqueOrdered(values: string[]): string[] {
    return Array.from(new Set(values));
  }

  private getTransitRouteStreetsCoverageNote(
    hasGeometry: boolean,
    hasStreetSequence: boolean,
    hasDirectionSplit: boolean,
  ): string | undefined {
    if (!hasGeometry) {
      return 'La ruta existe en catalogo, pero no tiene geometria valida inyectada; no se puede listar por donde coge.';
    }

    if (!hasStreetSequence) {
      return 'La ruta tiene geometria, pero la fuente actual no trae nombres de calles/carreras; se evita inventar una secuencia.';
    }

    if (!hasDirectionSplit) {
      return 'La fuente trae secuencia de calles/carreras, pero no separa oficialmente ida y vuelta.';
    }

    return undefined;
  }

  private getSourceVersion(): string {
    return (
      this.configService.get<string>('TRANSIT_SOURCE_VERSION') ??
      'quilla-gtfs-draft'
    );
  }

  private getTransitMapColor(
    agencyKind: 'transmetro' | 'colectivo',
    sourceKind?: TransitMapRouteFeature['properties']['sourceKind'],
  ): string {
    if (sourceKind === 'secondary_reference') {
      return TRANSIT_MAP_COLORS.secondary;
    }

    return TRANSIT_MAP_COLORS[agencyKind];
  }

  private getTransitOperatingStatus(
    metadata: TransitRouteMetadata | null | undefined,
    now = new Date(),
    routeShortName?: string,
  ): TransitOperatingStatus {
    const inferredExpressCondition = this.isTransmetroExpressRoute(
      routeShortName,
    )
      ? 'peak_hours'
      : undefined;
    const condition =
      metadata?.operatingCondition ?? inferredExpressCondition ?? 'always';
    const label = metadata?.operatingConditionLabel;

    if (
      metadata?.isCurrentlyOperatingOverride === false ||
      condition === 'temporarily_suspended'
    ) {
      return {
        isCurrentlyOperating: false,
        operatingCondition: 'temporarily_suspended',
        operatingConditionLabel: label ?? 'Temporalmente parada.',
      };
    }

    if (condition === 'christmas_season') {
      return {
        isCurrentlyOperating: this.isWithinAnnualWindow(
          now,
          metadata?.seasonalWindow?.startsOn ?? '11-15',
          metadata?.seasonalWindow?.endsOn ?? '01-15',
        ),
        operatingCondition: condition,
        operatingConditionLabel: label ?? 'Solo opera en temporada navidena.',
      };
    }

    if (condition === 'weekends') {
      return {
        isCurrentlyOperating: this.isWeekend(now),
        operatingCondition: condition,
        operatingConditionLabel: label ?? 'Solo opera los fines de semana.',
      };
    }

    if (condition === 'peak_hours') {
      return {
        isCurrentlyOperating: this.isWithinPeakHours(
          now,
          metadata?.peakHours ?? DEFAULT_TRANSMETRO_EXPRESS_PEAK_HOURS,
        ),
        operatingCondition: condition,
        operatingConditionLabel:
          label ?? 'Ruta expresa: opera solo en horas pico configuradas.',
      };
    }

    return {
      isCurrentlyOperating: true,
      operatingCondition: 'always',
      operatingConditionLabel: label,
    };
  }

  private getRouteRequestDate(routeRequest: TransitRouteRequestDto): Date {
    if (!routeRequest.departureIso) {
      return new Date();
    }

    const parsed = new Date(routeRequest.departureIso);

    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private isTransmetroExpressRoute(routeShortName?: string): boolean {
    const routeCode = this.getTransmetroRouteCode(routeShortName);

    return Boolean(routeCode && TRANSMETRO_EXPRESS_ROUTE_CODES.has(routeCode));
  }

  private getTransmetroRouteCode(routeShortName?: string): string | undefined {
    return routeShortName?.toUpperCase().match(/\b[RS]\d{2}\b/)?.[0];
  }

  private isWithinPeakHours(
    date: Date,
    peakHours: NonNullable<TransitRouteMetadata['peakHours']>,
  ): boolean {
    const localDate = this.getLocalDateParts(date);

    if (
      peakHours.weekdaysOnly !== false &&
      (localDate.weekday === 0 || localDate.weekday === 6)
    ) {
      return false;
    }

    const currentMinutes = localDate.hour * 60 + localDate.minute;

    return (peakHours.windows ?? []).some((window) => {
      const start = this.parseTimeToMinutes(window.startsAt);
      const end = this.parseTimeToMinutes(window.endsAt);

      if (start === null || end === null) {
        return false;
      }

      if (start <= end) {
        return currentMinutes >= start && currentMinutes <= end;
      }

      return currentMinutes >= start || currentMinutes <= end;
    });
  }

  private getLocalDateParts(date: Date): {
    weekday: number;
    hour: number;
    minute: number;
  } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: COLOMBIA_TIME_ZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value;

    return {
      weekday: weekdayMap[getPart('weekday') ?? 'Sun'] ?? 0,
      hour: Number(getPart('hour') ?? 0),
      minute: Number(getPart('minute') ?? 0),
    };
  }

  private parseTimeToMinutes(value: string): number | null {
    const match = value.match(/^(\d{2}):(\d{2})$/);

    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) {
      return null;
    }

    return hour * 60 + minute;
  }

  private isWeekend(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private isWithinAnnualWindow(
    date: Date,
    startsOn: string,
    endsOn: string,
  ): boolean {
    const current = this.toMonthDayNumber(date);
    const start = this.parseMonthDay(startsOn);
    const end = this.parseMonthDay(endsOn);

    if (!start || !end) {
      return false;
    }

    if (start <= end) {
      return current >= start && current <= end;
    }

    return current >= start || current <= end;
  }

  private toMonthDayNumber(date: Date): number {
    return (date.getMonth() + 1) * 100 + date.getDate();
  }

  private parseMonthDay(value: string): number | null {
    const match = /^(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return month * 100 + day;
  }

  private assertSupportedMode(mode: TransitMode): void {
    if (mode !== TransitMode.PEATON && mode !== TransitMode.TURISTA) {
      throw new BadRequestException(
        'Transit solo esta disponible para modos peaton y turista.',
      );
    }
  }

  private toLineString(geometry: TransitCoordinate[]) {
    return {
      type: 'LineString' as const,
      coordinates: geometry.map((point) => [point.longitude, point.latitude]),
    };
  }
}
