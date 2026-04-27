import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReportsService } from '@/features/reports/reports.service';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { SupabaseAuthGuard } from '@/features/auth/guards/supabase-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { SupabaseJwtPayload } from '@/features/auth/interfaces/supabase-payload.interface';

@Controller('reports')
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  createReport(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.reportsService.createReport(createReportDto, user.sub);
  }
}
