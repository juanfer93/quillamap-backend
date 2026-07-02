import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from '@/features/reports/reports.service';
import { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Report } from '@/features/reports/entities/report.entity';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { JwtAuthGuard } from '@/features/auth/guards/jwt-auth.guard';

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

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a report at a PostGIS geography point' })
  @ApiResponse({ status: 201, description: 'Creates a report.', type: Report })
  createReport(
    @Body() createReportDto: CreateReportDto,
    @Req() request: { user: { userId: string } },
  ) {
    return this.reportsService.createReport(createReportDto, request.user.userId);
  }
}
