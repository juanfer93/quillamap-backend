import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { Repository } from 'typeorm';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { ProfilesService } from '@/features/profiles/profiles.service';
import type { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportValidation)
    private readonly reportValidationRepository: Repository<ReportValidation>,
    private readonly profilesService: ProfilesService,
  ) {}

  async createReport(
    createReportDto: CreateReportDto,
    profileId: string,
  ): Promise<Report> {
    const newReport = this.reportRepository.create({
      ...createReportDto,
      profileId,
    });

    const createdReport = await this.reportRepository.save(newReport);

    await this.profilesService.incrementKarma(profileId, 10);

    return createdReport;
  }

  async findNearby(filter: GetReportsFilterDto): Promise<Report[]> {
    const { lat, lng, radius = 5000 } = filter;

    return this.reportRepository
      .createQueryBuilder('report')
      .where(
        'ST_DWithin(report.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4321), :radius)',
        {
          lat,
          lng,
          radius,
        },
      )
      .orderBy('report.createdAt', 'DESC')
      .getMany();
  }

  async validateReport(
    reportId: string,
    profileId: string,
    isConfirmed: boolean,
  ): Promise<void> {
    const report = await this.reportRepository.findOneOrFail({ where: { id: reportId } });

    if (report.profileId === profileId) {
      throw new ForbiddenException('Users cannot validate their own reports.');
    }

    const validation = this.reportValidationRepository.create({
      report,
      profile: { id: profileId },
      isConfirmed,
    });

    await this.reportValidationRepository.save(validation);

    if (isConfirmed) {
      await this.profilesService.incrementKarma(report.profileId, 5);
      await this.profilesService.incrementKarma(profileId, 2);
    } else {
      const negativeValidations = await this.reportValidationRepository.count({
        where: { report: { id: reportId }, isConfirmed: false },
      });

      if (negativeValidations >= 3) {
        report.status = ReportStatus.RESUELTO; // Assuming RESUELTO means resolved/false
        await this.reportRepository.save(report);
      }
    }
  }
}
