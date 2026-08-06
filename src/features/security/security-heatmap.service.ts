import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { Report } from '@/features/reports/entities/report.entity';
import type { GetSecurityHeatmapDto } from '@/features/reports/dto/get-security-heatmap.dto';
import {
  AMB_MAIN_ROAD_CORRIDORS_WKT,
  SECURITY_HEATMAP_DBSCAN_RADIUS_METERS,
  SECURITY_HEATMAP_EVIDENCE_PRIORITY_FROM,
  SECURITY_HEATMAP_EVIDENCE_WEIGHT,
  SECURITY_HEATMAP_MAIN_ROAD_BUFFER_METERS,
  SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
  SECURITY_HEATMAP_MAX_NEGATIVE_VOTES,
  SECURITY_HEATMAP_METRO_CENTER_LAT,
  SECURITY_HEATMAP_METRO_CENTER_LNG,
  SECURITY_HEATMAP_METRO_RADIUS_METERS,
  SECURITY_HEATMAP_MIN_KARMA_SCORE,
  SECURITY_HEATMAP_MIN_REPORTS_PER_CLUSTER,
  SECURITY_HEATMAP_RANDOM_FOREST_PRECISION,
  SECURITY_HEATMAP_SUPABASE_EVIDENCE_PATTERN,
  SECURITY_HEATMAP_TIME_ZONE,
  SECURITY_HEATMAP_WINDOW_MINUTES,
  SECURITY_METADATA_PRIMARY_COLOR,
  SECURITY_RISK_LABELS,
  TOURIST_SAFETY_MILESTONE_COLOR,
} from '@/features/security/security-heatmap.constants';
import type {
  SecurityHeatmapPoint,
  SecurityHeatmapResponse,
  SecurityRiskLabels,
  SecurityRiskLevel,
} from '@/types/contracts/security.contract';
import { SECURITY_HEATMAP_QUERY } from '@/features/security/queries/security-heatmap.query';
import { Repository } from 'typeorm';

interface SecurityHeatmapRow {
  clusterId: string | number;
  longitude: string | number;
  latitude: string | number;
  intensity: string | number;
  dangerLevel: string | number;
  veracityScore: string | number;
  reportCount: string | number;
  radiusMeters: string | number;
  riskLevel: string;
  hasVerifiedEvidence: boolean | string;
  generatedFrom: Date | string;
  generatedTo: Date | string;
}

@Injectable()
export class SecurityHeatmapService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async findHeatmap(
    filter: GetSecurityHeatmapDto,
  ): Promise<SecurityHeatmapResponse> {
    const rawRows: unknown = await this.reportRepository.query(
      SECURITY_HEATMAP_QUERY,
      this.toQueryParams(filter),
    );
    const rows = rawRows as SecurityHeatmapRow[];

    return this.toResponse(rows);
  }

  private toQueryParams(filter: GetSecurityHeatmapDto): unknown[] {
    const { criticalOnly = false } = filter;
    const proximityRadius = filter.proximityRadius ?? 500;

    return [
      ReportType.INSEGURIDAD,
      ReportStatus.ACTIVO,
      SECURITY_HEATMAP_MIN_KARMA_SCORE,
      SECURITY_HEATMAP_METRO_CENTER_LNG,
      SECURITY_HEATMAP_METRO_CENTER_LAT,
      SECURITY_HEATMAP_METRO_RADIUS_METERS,
      criticalOnly,
      proximityRadius,
      SECURITY_HEATMAP_MAX_NEGATIVE_VOTES,
      SECURITY_HEATMAP_DBSCAN_RADIUS_METERS,
      AMB_MAIN_ROAD_CORRIDORS_WKT,
      SECURITY_HEATMAP_MAIN_ROAD_BUFFER_METERS,
      SECURITY_HEATMAP_TIME_ZONE,
      SECURITY_HEATMAP_EVIDENCE_PRIORITY_FROM,
      SECURITY_HEATMAP_SUPABASE_EVIDENCE_PATTERN,
      SECURITY_HEATMAP_MIN_REPORTS_PER_CLUSTER,
      SECURITY_HEATMAP_RANDOM_FOREST_PRECISION,
      SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
      SECURITY_HEATMAP_EVIDENCE_WEIGHT,
    ];
  }

  private toResponse(rows: SecurityHeatmapRow[]): SecurityHeatmapResponse {
    return {
      generatedAt: new Date().toISOString(),
      windowMinutes: SECURITY_HEATMAP_WINDOW_MINUTES,
      dbscanRadiusMeters: SECURITY_HEATMAP_DBSCAN_RADIUS_METERS,
      minReportsPerCluster: SECURITY_HEATMAP_MIN_REPORTS_PER_CLUSTER,
      metadata: this.getMetadata(),
      points: rows.map((row) => this.toPoint(row)),
    };
  }

  private getMetadata() {
    return {
      primaryColor: SECURITY_METADATA_PRIMARY_COLOR,
      touristSafetyMilestoneColor: TOURIST_SAFETY_MILESTONE_COLOR,
      riskLabels: SECURITY_RISK_LABELS satisfies SecurityRiskLabels,
    };
  }

  private toPoint(row: SecurityHeatmapRow): SecurityHeatmapPoint {
    const intensity = this.clamp(this.toNumber(row.intensity), 0, 1);
    const veracityScore = this.clamp(this.toNumber(row.veracityScore), 0, 1);
    const dangerLevel = Math.round(
      this.clamp(this.toNumber(row.dangerLevel), 1, 5),
    );

    return {
      clusterId: String(row.clusterId),
      latitude: this.toNumber(row.latitude),
      longitude: this.toNumber(row.longitude),
      intensity,
      dangerLevel,
      veracityScore,
      reportCount: this.toNumber(row.reportCount),
      radiusMeters: this.toNumber(row.radiusMeters),
      riskLevel: this.normalizeRiskLevel(row.riskLevel, intensity, dangerLevel),
      hasVerifiedEvidence:
        row.hasVerifiedEvidence === true || row.hasVerifiedEvidence === 'true',
      generatedFrom: new Date(row.generatedFrom).toISOString(),
      generatedTo: new Date(row.generatedTo).toISOString(),
    };
  }

  private normalizeRiskLevel(
    riskLevel: string,
    intensity: number,
    dangerLevel: number,
  ): SecurityRiskLevel {
    if (
      riskLevel === 'low' ||
      riskLevel === 'medium' ||
      riskLevel === 'high' ||
      riskLevel === 'critical'
    ) {
      return riskLevel;
    }

    if (intensity >= 0.8 || dangerLevel >= 5) {
      return 'critical';
    }
    if (intensity >= 0.6 || dangerLevel >= 4) {
      return 'high';
    }
    if (intensity >= 0.35 || dangerLevel >= 3) {
      return 'medium';
    }
    return 'low';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private toNumber(value: string | number): number {
    return typeof value === 'number' ? value : Number(value);
  }
}
