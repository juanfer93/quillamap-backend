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

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findNearby(@Query() filterDto: GetReportsFilterDto) {
    return this.reportsService.findNearby(filterDto);
  }

  @Post()
  @UseGuards(SupabaseAuthGuard)
  createReport(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.reportsService.createReport(createReportDto, user.sub);
  }

  @Post(':id/validate')
  @UseGuards(SupabaseAuthGuard)
  validateReport(
    @Param('id') id: string,
    @Body('isConfirmed') isConfirmed: boolean,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.reportsService.validateReport(id, user.sub, isConfirmed);
  }
}
