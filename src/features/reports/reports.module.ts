import { Module } from '@nestjs/common';
import { ReportsService } from '@/features/reports/reports.service';
import { ReportsController } from '@/features/reports/reports.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { ProfilesModule } from '@/features/profiles/profiles.module';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportValidation]), ProfilesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
