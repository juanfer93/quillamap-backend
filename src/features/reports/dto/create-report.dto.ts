import { IsEnum, IsString } from 'class-validator';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { Point } from 'geojson';

export class CreateReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsString()
  description: string;

  location: Point;
}
