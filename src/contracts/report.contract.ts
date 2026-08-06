import type { Point } from 'geojson';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { ReportType } from '@/features/reports/entities/report-type.enum';

export interface CreateReportContract {
  type: ReportType;
  description: string;
  location: Point;
  userLocation?: Point;
  imageUrl?: string | null;
  dangerLevel?: number;
}

export interface ReportContract {
  id: string;
  type: ReportType;
  description: string;
  location: Point;
  status: ReportStatus;
  createdAt: Date;
  expiresAt: Date | null;
  profileId: string;
  imageUrl: string | null;
  dangerLevel: number;
  intensity: number | null;
  veracityScore: number | null;
}
