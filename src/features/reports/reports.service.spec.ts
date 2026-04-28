import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Point } from 'geojson';
import { ReportsService } from '@/features/reports/reports.service';
import { Report } from '@/features/reports/entities/report.entity';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';

describe('ReportsService', () => {
  let service: ReportsService;
  let repository: Repository<Report>;
  let profilesService: ProfilesService;

  const mockReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockProfilesService = {
    incrementKarma: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportRepository,
        },
        {
          provide: ProfilesService,
          useValue: mockProfilesService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    repository = module.get<Repository<Report>>(getRepositoryToken(Report));
    profilesService = module.get<ProfilesService>(ProfilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReport', () => {
    it('should create a report and add karma to the user', async () => {
      const location: Point = { type: 'Point', coordinates: [-74.08175, 4.60971] };
      const createReportDto: CreateReportDto = {
        type: ReportType.BACHE,
        description: 'Un bache grande en la vía',
        location,
      };
      const profileId = 'user-123';

      const report = {
        id: '1',
        ...createReportDto,
        profileId,
        status: ReportStatus.ACTIVO,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Report;

      mockReportRepository.create.mockReturnValue(report);
      mockReportRepository.save.mockResolvedValue(report);

      const result = await service.createReport(createReportDto, profileId);

      expect(mockReportRepository.create).toHaveBeenCalledWith({
        ...createReportDto,
        profileId,
      });
      expect(mockReportRepository.save).toHaveBeenCalledWith(report);
      expect(mockProfilesService.incrementKarma).toHaveBeenCalledWith(profileId, 10);
      expect(result).toEqual(report);
    });
  });

  describe('findNearby', () => {
    it('should call the query builder with ST_DWithin for finding nearby reports', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockReportRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const filter: GetReportsFilterDto = {
        lat: 4.60971,
        lng: -74.08175,
        radius: 1000,
      };

      await service.findNearby(filter);

      expect(mockReportRepository.createQueryBuilder).toHaveBeenCalledWith('report');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'ST_DWithin(report.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4321), :radius)',
        {
          lat: filter.lat,
          lng: filter.lng,
          radius: filter.radius,
        },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('report.createdAt', 'DESC');
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });
  });
});
