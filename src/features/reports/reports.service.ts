import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { Repository } from 'typeorm';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { ProfilesService } from '@/features/profiles/profiles.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
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
}
