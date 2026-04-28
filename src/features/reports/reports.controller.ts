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
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { SupabaseJwtPayload } from '@/features/auth/interfaces/supabase-payload.interface';
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

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Create a new report' })
  @ApiResponse({ status: 201, description: 'The report has been successfully created.', type: Report })
  createReport(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.reportsService.createReport(createReportDto, user.sub);
  }

  @Post(':id/validate')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Validate a report (community validation)' })
  @ApiResponse({ status: 200, description: 'The report validation has been registered.' })
  validateReport(
    @Param('id') id: string,
    @Body('isConfirmed') isConfirmed: boolean,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.reportsService.validateReport(id, user.sub, isConfirmed);
  }
}
