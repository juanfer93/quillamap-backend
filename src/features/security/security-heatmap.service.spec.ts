import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { Report } from '@/features/reports/entities/report.entity';
import {
  SECURITY_HEATMAP_DBSCAN_RADIUS_METERS,
  SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
  SECURITY_HEATMAP_METRO_CENTER_LAT,
  SECURITY_HEATMAP_METRO_CENTER_LNG,
  SECURITY_HEATMAP_METRO_RADIUS_METERS,
  SECURITY_HEATMAP_MIN_REPORTS_PER_CLUSTER,
  SECURITY_HEATMAP_RANDOM_FOREST_PRECISION,
} from '@/features/security/security-heatmap.constants';
import { SecurityHeatmapService } from '@/features/security/security-heatmap.service';

describe('SecurityHeatmapService', () => {
  let service: SecurityHeatmapService;

  const mockReportRepository = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityHeatmapService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportRepository,
        },
      ],
    }).compile();

    service = module.get<SecurityHeatmapService>(SecurityHeatmapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('clusters anonymized security reports with DBSCAN and veracity weights', async () => {
    const generatedFrom = new Date('2026-08-04T12:00:00.000Z');
    const generatedTo = new Date('2026-08-04T12:40:00.000Z');

    mockReportRepository.query.mockResolvedValue([
      {
        clusterId: '0',
        longitude: '-74.789',
        latitude: '10.987',
        intensity: '0.7812',
        dangerLevel: 4,
        veracityScore: '0.9321',
        reportCount: 5,
        radiusMeters: '238.4',
        riskLevel: 'high',
        hasVerifiedEvidence: true,
        generatedFrom,
        generatedTo,
        profileId: 'must-not-be-returned',
      },
    ]);

    const result = await service.findHeatmap({
      lat: 10.987,
      lng: -74.789,
      radius: 2000,
      criticalOnly: true,
      proximityRadius: 500,
    });

    const [sql, params] = mockReportRepository.query.mock.calls[0] as [
      string,
      unknown[],
    ];

    expect(sql).toContain('ST_ClusterDBSCAN');
    expect(sql).toContain('ST_DWithin');
    expect(sql).toContain('r.type = $1');
    expect(sql).toContain('coalesce(p.karma, 0) >= $3');
    expect(sql).toContain('r.image_url like $15');
    expect(sql).toContain('filter (where v."isConfirmed" = false)');
    expect(params).toEqual(
      expect.arrayContaining([
        ReportType.INSEGURIDAD,
        ReportStatus.ACTIVO,
        SECURITY_HEATMAP_METRO_CENTER_LNG,
        SECURITY_HEATMAP_METRO_CENTER_LAT,
        SECURITY_HEATMAP_METRO_RADIUS_METERS,
        SECURITY_HEATMAP_DBSCAN_RADIUS_METERS,
        SECURITY_HEATMAP_MIN_REPORTS_PER_CLUSTER,
        SECURITY_HEATMAP_RANDOM_FOREST_PRECISION,
        SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
      ]),
    );
    expect(result.points).toEqual([
      {
        clusterId: '0',
        latitude: 10.987,
        longitude: -74.789,
        intensity: 0.7812,
        dangerLevel: 4,
        veracityScore: 0.9321,
        reportCount: 5,
        radiusMeters: 238.4,
        riskLevel: 'high',
        hasVerifiedEvidence: true,
        generatedFrom: generatedFrom.toISOString(),
        generatedTo: generatedTo.toISOString(),
      },
    ]);
    expect(result.metadata).toEqual({
      primaryColor: '#004574',
      touristSafetyMilestoneColor: '#D4AF37',
      riskLabels: {
        low: 'Bajo',
        medium: 'Moderado',
        high: 'Peligroso',
        critical: 'Muy peligroso',
      },
    });
    expect(JSON.stringify(result)).not.toContain('must-not-be-returned');
  });

  it('serializes points exactly per the security contract shape', async () => {
    mockReportRepository.query.mockResolvedValue([
      {
        clusterId: '0',
        longitude: '-74.789',
        latitude: '10.987',
        intensity: '0.7812',
        dangerLevel: 4,
        veracityScore: '0.9321',
        reportCount: 5,
        radiusMeters: '238.4',
        riskLevel: 'high',
        hasVerifiedEvidence: true,
        generatedFrom: new Date('2026-08-04T12:00:00.000Z'),
        generatedTo: new Date('2026-08-04T12:40:00.000Z'),
      },
    ]);

    const result = await service.findHeatmap({
      lat: 10.987,
      lng: -74.789,
      radius: 2000,
    });

    expect(Object.keys(result).sort()).toEqual([
      'dbscanRadiusMeters',
      'generatedAt',
      'metadata',
      'minReportsPerCluster',
      'points',
      'windowMinutes',
    ]);
    expect(Object.keys(result.metadata).sort()).toEqual([
      'primaryColor',
      'riskLabels',
      'touristSafetyMilestoneColor',
    ]);
    expect(Object.keys(result.points[0]).sort()).toEqual([
      'clusterId',
      'dangerLevel',
      'generatedFrom',
      'generatedTo',
      'hasVerifiedEvidence',
      'intensity',
      'latitude',
      'longitude',
      'radiusMeters',
      'reportCount',
      'riskLevel',
      'veracityScore',
    ]);
  });

  it('clamps score ranges and falls back to a valid risk level', async () => {
    mockReportRepository.query.mockResolvedValue([
      {
        clusterId: '0',
        longitude: '-74.789',
        latitude: '10.987',
        intensity: '1.4',
        dangerLevel: 7,
        veracityScore: '-0.2',
        reportCount: 5,
        radiusMeters: '238.4',
        riskLevel: 'unknown',
        hasVerifiedEvidence: 'false',
        generatedFrom: new Date('2026-08-04T12:00:00.000Z'),
        generatedTo: new Date('2026-08-04T12:40:00.000Z'),
      },
    ]);

    const result = await service.findHeatmap({
      lat: 10.987,
      lng: -74.789,
      radius: 2000,
    });

    expect(result.points[0].intensity).toBe(1);
    expect(result.points[0].dangerLevel).toBe(5);
    expect(result.points[0].veracityScore).toBe(0);
    expect(result.points[0].riskLevel).toBe('critical');
    expect(result.points[0].hasVerifiedEvidence).toBe(false);
  });
});
