import { IsEnum, IsString } from 'class-validator';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import type { Point } from 'geojson';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({
    description: 'Type of the report',
    enum: ReportType,
    example: ReportType.RETEN,
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({
    description: 'Description of the report',
    example: 'Retén en la entrada de la ciudad',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'GeoJSON Point for the report location',
    example: { type: 'Point', coordinates: [-74.79, 10.99] },
    type: 'object',
  })
  location: Point;
}
