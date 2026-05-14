import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from '@/features/reports/reports.service';
import { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Report } from '@/features/reports/entities/report.entity';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Find nearby reports' })
  @ApiResponse({ status: 200, description: 'Returns a list of nearby reports.', type: [Report] })
  findNearby(@Query() filterDto: GetReportsFilterDto) {
    return this.reportsService.findNearby(filterDto);
  }

}
