import { DataSource } from 'typeorm';
import type { Point, Polygon } from 'geojson';
import { RestrictionType } from '@/features/zones/enums/restriction-type.enum';
import { DayOfWeek, ZoneRulesMetadata } from '@/features/zones/interfaces/zone-rules.interface';
import { VehicleType } from '@/features/profiles/entities/vehicle_type.enum';
import { TrafficCamera } from '@/features/security/entities/traffic-camera.entity';
import type { SecurityInfrastructureType } from '@/features/security/entities/traffic-camera.entity';
import { Zone } from '@/features/zones/entities/zone.entity';

const ALL_DAYS = Object.values(DayOfWeek);
const PRIMARY_COLOR = '#004574' as const;
const TOURIST_COLOR = '#D4AF37' as const;

interface CivilRiskZoneSeed {
  name: string;
  boundary: Polygon;
  riskLevel: 'high' | 'critical';
  historicalBasis: string;
}

interface TrafficCameraSeed {
  externalId: string;
  name: string;
  location: Point;
  source: string;
  infrastructureType: SecurityInfrastructureType;
}

const civilRiskRules = (
  zone: CivilRiskZoneSeed,
): ZoneRulesMetadata & { security: Record<string, unknown> } => ({
  metadata: [{
    type: RestrictionType.RIESGO_CIVIL,
    vehicleType: VehicleType.PEATON,
    startTime: '00:00',
    endTime: '23:59',
    days: ALL_DAYS,
    plateCondition: { allPlates: true },
  }],
  security: {
    riskLevel: zone.riskLevel,
    historicalBasis: zone.historicalBasis,
    legalPerimeter: true,
    primaryColor: PRIMARY_COLOR,
    touristSafetyMilestoneColor: TOURIST_COLOR,
  },
});

const polygon = (ring: [number, number][]): Polygon => ({
  type: 'Polygon',
  coordinates: [ring],
});

const point = (longitude: number, latitude: number): Point => ({
  type: 'Point',
  coordinates: [longitude, latitude],
});

const CIVIL_RISK_ZONES: CivilRiskZoneSeed[] = [
  {
    name: 'Perimetro Legal - Barranquilla',
    riskLevel: 'critical',
    historicalBasis: 'Legal AMB perimeter for Barranquilla security aggregation.',
    boundary: polygon([
      [-74.89, 11.09],
      [-74.73, 11.09],
      [-74.73, 10.89],
      [-74.89, 10.89],
      [-74.89, 11.09],
    ]),
  },
  {
    name: 'Perimetro Legal - Soledad',
    riskLevel: 'high',
    historicalBasis: 'Legal AMB perimeter for Soledad security aggregation.',
    boundary: polygon([
      [-74.83, 10.96],
      [-74.70, 10.96],
      [-74.70, 10.86],
      [-74.83, 10.86],
      [-74.83, 10.96],
    ]),
  },
  {
    name: 'Perimetro Legal - Malambo',
    riskLevel: 'high',
    historicalBasis: 'Legal AMB perimeter for Malambo security aggregation.',
    boundary: polygon([
      [-74.86, 10.92],
      [-74.70, 10.92],
      [-74.70, 10.80],
      [-74.86, 10.80],
      [-74.86, 10.92],
    ]),
  },
  {
    name: 'Perimetro Legal - Galapa',
    riskLevel: 'high',
    historicalBasis: 'Legal AMB perimeter for Galapa security aggregation.',
    boundary: polygon([
      [-74.98, 10.96],
      [-74.82, 10.96],
      [-74.82, 10.83],
      [-74.98, 10.83],
      [-74.98, 10.96],
    ]),
  },
  {
    name: 'Perimetro Legal - Puerto Colombia',
    riskLevel: 'high',
    historicalBasis: 'Legal AMB perimeter for Puerto Colombia tourist-security aggregation.',
    boundary: polygon([
      [-75.10, 11.12],
      [-74.86, 11.12],
      [-74.86, 10.96],
      [-75.10, 10.96],
      [-75.10, 11.12],
    ]),
  },
];

const TRAFFIC_CAMERAS: TrafficCameraSeed[] = [
  {
    externalId: 'amb-cam-cra46-calle84',
    name: 'Camara Cra 46 con Calle 84',
    location: point(-74.8189, 11.0045),
    source: 'AMB fixed traffic monitoring inventory',
    infrastructureType: 'traffic_camera',
  },
  {
    externalId: 'amb-cam-murillo-cra21',
    name: 'Camara Murillo con Carrera 21',
    location: point(-74.7892, 10.9589),
    source: 'AMB fixed traffic monitoring inventory',
    infrastructureType: 'traffic_camera',
  },
  {
    externalId: 'amb-cam-soledad-centro',
    name: 'Camara Centro de Soledad',
    location: point(-74.7647, 10.9183),
    source: 'AMB fixed traffic monitoring inventory',
    infrastructureType: 'traffic_camera',
  },
];

const CULTURAL_LANDMARKS: TrafficCameraSeed[] = [
  {
    externalId: 'amb-landmark-ventana-al-mundo',
    name: 'Ventana al Mundo',
    location: point(-74.8496, 11.019),
    source: 'AMB tourist safety cultural landmark inventory',
    infrastructureType: 'cultural_landmark',
  },
  {
    externalId: 'amb-landmark-malecon-rio',
    name: 'Gran Malecon del Rio',
    location: point(-74.7818, 11.0243),
    source: 'AMB tourist safety cultural landmark inventory',
    infrastructureType: 'cultural_landmark',
  },
  {
    externalId: 'amb-landmark-castillo-salgar',
    name: 'Castillo de Salgar',
    location: point(-74.9505, 11.0195),
    source: 'AMB tourist safety cultural landmark inventory',
    infrastructureType: 'cultural_landmark',
  },
];

const assertServiceRoleKey = (): void => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for security seeds.');
  }
};

const upsertCivilRiskZone = async (
  dataSource: DataSource,
  zone: CivilRiskZoneSeed,
): Promise<void> => {
  const repository = dataSource.getRepository(Zone);
  const existing = await repository.findOne({ where: { name: zone.name } });

  await repository.save({
    ...existing,
    name: zone.name,
    boundary: zone.boundary,
    rules: civilRiskRules(zone),
    active: true,
  });
};

const upsertTrafficCamera = async (
  dataSource: DataSource,
  camera: TrafficCameraSeed,
): Promise<void> => {
  await dataSource.getRepository(TrafficCamera).upsert(
    {
      ...camera,
      verified: true,
      verificationScore: 1,
      metadata: {
        owner: 'AMB',
        source: camera.source,
        infrastructureType: camera.infrastructureType,
        primaryColor: PRIMARY_COLOR,
        touristSafetyMilestoneColor: camera.infrastructureType === 'cultural_landmark'
          ? TOURIST_COLOR
          : undefined,
      },
    },
    ['externalId'],
  );
};

export const seedSecurityInfrastructure = async (
  dataSource: DataSource,
): Promise<{
  cameras: number;
  culturalLandmarks: number;
  civilRiskZones: number;
}> => {
  assertServiceRoleKey();

  for (const zone of CIVIL_RISK_ZONES) {
    await upsertCivilRiskZone(dataSource, zone);
  }

  for (const infrastructure of [...TRAFFIC_CAMERAS, ...CULTURAL_LANDMARKS]) {
    await upsertTrafficCamera(dataSource, infrastructure);
  }

  return {
    cameras: TRAFFIC_CAMERAS.length,
    culturalLandmarks: CULTURAL_LANDMARKS.length,
    civilRiskZones: CIVIL_RISK_ZONES.length,
  };
};
