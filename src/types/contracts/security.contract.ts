export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SecurityRiskLabels = Record<SecurityRiskLevel, string>;

export interface SecurityHeatmapMetadata {
  primaryColor: '#004574';
  touristSafetyMilestoneColor: '#D4AF37';
  riskLabels: SecurityRiskLabels;
}

export interface SecurityHeatmapPoint {
  clusterId: string;
  latitude: number;
  longitude: number;
  intensity: number;
  dangerLevel: number;
  veracityScore: number;
  reportCount: number;
  radiusMeters: number;
  riskLevel: SecurityRiskLevel;
  hasVerifiedEvidence: boolean;
  generatedFrom: string;
  generatedTo: string;
}

export interface SecurityHeatmapResponse {
  generatedAt: string;
  windowMinutes: number;
  dbscanRadiusMeters: number;
  minReportsPerCluster: number;
  metadata: SecurityHeatmapMetadata;
  points: SecurityHeatmapPoint[];
}

export type SecurityHeatmapPointContract = SecurityHeatmapPoint;
export type SecurityHeatmapResponseContract = SecurityHeatmapResponse;
