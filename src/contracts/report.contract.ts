import type { Point } from 'geojson';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { ReportType } from '@/features/reports/entities/report-type.enum';

export interface CreateReportContract {
  type: ReportType;
  description: string;
  location: Point;
  imageUrl?: string | null;
}

export interface ReportContract {
  id: string;
  type: ReportType;
  description: string;
  location: Point;
  status: ReportStatus;
  createdAt: Date;
  profileId: string;
  imageUrl: string | null;
}
