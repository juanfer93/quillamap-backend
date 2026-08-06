import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Report } from '@/features/reports/entities/report.entity';
import { Repository } from 'typeorm';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { ProfilesService } from '@/features/profiles/profiles.service';
import type { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { SupabaseStorageService } from '@/features/evidence/supabase-storage.service';
import { ALLOWED_EVIDENCE_MIME_TYPES } from '@/features/evidence/evidence.constants';
import { SECURITY_HEATMAP_PRESENCE_RADIUS_METERS } from '@/features/security/security-heatmap.constants';
import type { Point } from 'geojson';

export const TRUTHFUL_REPORT_KARMA_POINTS = 6;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportValidation)
    private readonly reportValidationRepository: Repository<ReportValidation>,
    private readonly profilesService: ProfilesService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  async createReport(
    createReportDto: CreateReportDto,
    profileId: string,
  ): Promise<Report> {
    await this.assertWithinPresenceRadius(
      createReportDto.location,
      createReportDto.userLocation ?? createReportDto.location,
    );

    const { userLocation: _userLocation, ...reportData } = createReportDto;
    const newReport = this.reportRepository.create({
      ...reportData,
      profileId,
    });

    const createdReport = await this.reportRepository.save(newReport);

    await this.profilesService.incrementKarma(
      profileId,
      TRUTHFUL_REPORT_KARMA_POINTS,
    );

    return createdReport;
  }

  async findNearby(filter: GetReportsFilterDto): Promise<Report[]> {
    const { lat, lng, radius = 400 } = filter;

    return this.reportRepository
      .createQueryBuilder('report')
      .where(
        'ST_DWithin(report.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
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
    userLocation?: Point,
  ): Promise<void> {
    const report = await this.reportRepository.findOneOrFail({
      where: { id: reportId },
    });

    if (report.profileId === profileId) {
      throw new ForbiddenException('Users cannot validate their own reports.');
    }

    if (userLocation) {
      await this.assertReportWithinPresence(reportId, userLocation);
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

  async uploadEvidence(
    reportId: string,
    profileId: string,
    file: Express.Multer.File,
  ): Promise<Report> {
    this.assertValidEvidenceImage(file);

    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(
        `Report with id "${reportId}" was not found.`,
      );
    }

    if (report.profileId !== profileId) {
      throw new ForbiddenException(
        'Users cannot upload evidence to reports they do not own.',
      );
    }

    const imageUrl = await this.supabaseStorageService.uploadReportImage(
      reportId,
      file.buffer,
      file.mimetype,
    );

    report.imageUrl = imageUrl;

    return this.reportRepository.save(report);
  }

  private assertValidEvidenceImage(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('An evidence image file is required.');
    }

    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid image type "${file.mimetype}". Allowed types: ${ALLOWED_EVIDENCE_MIME_TYPES.join(', ')}`,
      );
    }
  }

  private async assertWithinPresenceRadius(
    target: Point,
    userLocation: Point,
  ): Promise<void> {
    const isAllowed = await this.isPointWithinPresenceRadius(target, userLocation);

    if (!isAllowed) {
      throw new BadRequestException(
        'Report location is outside the 500m presence radius.',
      );
    }
  }

  private async assertReportWithinPresence(
    reportId: string,
    userLocation: Point,
  ): Promise<void> {
    const isAllowed = await this.isReportWithinPresenceRadius(reportId, userLocation);

    if (!isAllowed) {
      throw new BadRequestException(
        'Validation is outside the 500m presence radius.',
      );
    }
  }

  private async isPointWithinPresenceRadius(
    target: Point,
    userLocation: Point,
  ): Promise<boolean> {
    const [targetLng, targetLat] = target.coordinates;
    const [userLng, userLat] = userLocation.coordinates;
    const [row] = await this.reportRepository.query(
      `select ST_DWithin(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
        $5
      ) as "isAllowed"`,
      [targetLng, targetLat, userLng, userLat, SECURITY_HEATMAP_PRESENCE_RADIUS_METERS],
    );

    return Boolean(row?.isAllowed);
  }

  private async isReportWithinPresenceRadius(
    reportId: string,
    userLocation: Point,
  ): Promise<boolean> {
    const [userLng, userLat] = userLocation.coordinates;
    const [row] = await this.reportRepository.query(
      `select ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      ) as "isAllowed"
      from report r
      where r.id = $4`,
      [userLng, userLat, SECURITY_HEATMAP_PRESENCE_RADIUS_METERS, reportId],
    );

    return Boolean(row?.isAllowed);
  }
}
