import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Point } from 'geojson';
import type { Readable } from 'stream';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ReportsService,
  TRUTHFUL_REPORT_KARMA_POINTS,
} from '@/features/reports/reports.service';
import { Report } from '@/features/reports/entities/report.entity';
import { ProfilesService } from '@/features/profiles/profiles.service';
import { CreateReportDto } from '@/features/reports/dto/create-report.dto';
import { ReportType } from '@/features/reports/entities/report-type.enum';
import { ReportStatus } from '@/features/reports/entities/report-status.enum';
import { GetReportsFilterDto } from '@/features/reports/dto/get-reports-filter.dto';
import { ReportValidation } from '@/features/reports/entities/report-validation.entity';
import { SupabaseStorageService } from '@/features/evidence/supabase-storage.service';
import { ALLOWED_EVIDENCE_MIME_TYPES } from '@/features/evidence/evidence.constants';

function createMockEvidenceFile(
  mimetype: string,
  size = 1024,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'evidence-image',
    encoding: '7bit',
    mimetype,
    buffer: Buffer.from('fake-image-bytes'),
    size,
    stream: {} as Readable,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('ReportsService', () => {
  let service: ReportsService;

  const mockReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOneOrFail: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
  };

  const mockReportValidationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockProfilesService = {
    incrementKarma: jest.fn(),
  };

  const mockSupabaseStorageService = {
    uploadReportImage: jest.fn(),
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
          provide: getRepositoryToken(ReportValidation),
          useValue: mockReportValidationRepository,
        },
        {
          provide: ProfilesService,
          useValue: mockProfilesService,
        },
        {
          provide: SupabaseStorageService,
          useValue: mockSupabaseStorageService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    mockReportRepository.query.mockResolvedValue([{ isAllowed: true }]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReport', () => {
    it('should create a report and add karma to the user', async () => {
      const location: Point = {
        type: 'Point',
        coordinates: [-74.08175, 4.60971],
      };
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
        imageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Report;

      mockReportRepository.create.mockReturnValue(report);
      mockReportRepository.save.mockResolvedValue(report);

      const result = await service.createReport(createReportDto, profileId);

      expect(mockReportRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        [-74.08175, 4.60971, -74.08175, 4.60971, 500],
      );
      expect(mockReportRepository.create).toHaveBeenCalledWith({
        ...createReportDto,
        profileId,
      });
      expect(mockReportRepository.save).toHaveBeenCalledWith(report);
      expect(mockProfilesService.incrementKarma).toHaveBeenCalledWith(
        profileId,
        TRUTHFUL_REPORT_KARMA_POINTS,
      );
      expect(result).toEqual(report);
    });

    it('should reject spoofed reports outside the 500m presence radius', async () => {
      mockReportRepository.query.mockResolvedValue([{ isAllowed: false }]);

      await expect(
        service.createReport(
          {
            type: ReportType.BACHE,
            description: 'Reporte lejos de la ubicacion real',
            location: { type: 'Point', coordinates: [-74.79, 10.99] },
            userLocation: { type: 'Point', coordinates: [-74.1, 10.1] },
          },
          'user-123',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Report location is outside the 500m presence radius.',
        ),
      );
      expect(mockReportRepository.save).not.toHaveBeenCalled();
    });

    it('should persist an "inseguridad" report with type "inseguridad" (never converted to "sombra")', async () => {
      const report = {
        id: 'danger-zone-1',
        type: ReportType.INSEGURIDAD,
        description: 'Zona peligrosa reportada por la comunidad',
        location: { type: 'Point', coordinates: [-74.789, 10.987] },
        profileId: 'user-123',
        status: ReportStatus.ACTIVO,
        imageUrl: null,
        createdAt: new Date(),
      } as unknown as Report;

      mockReportRepository.create.mockImplementation(
        (data: Partial<Report>) => ({ ...data, id: 'danger-zone-1' }),
      );
      mockReportRepository.save.mockResolvedValue(report);

      const result = await service.createReport(
        {
          type: ReportType.INSEGURIDAD,
          description: 'Zona peligrosa reportada por la comunidad',
          location: { type: 'Point', coordinates: [-74.789, 10.987] },
        },
        'user-123',
      );

      expect(mockReportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'inseguridad',
          description: 'Zona peligrosa reportada por la comunidad',
        }),
      );
      expect(mockReportRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'inseguridad' }),
      );
      expect(result.type).toBe(ReportType.INSEGURIDAD);
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
        radius: 2000,
      };

      await service.findNearby(filter);

      expect(mockReportRepository.createQueryBuilder).toHaveBeenCalledWith(
        'report',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'ST_DWithin(report.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
        {
          lat: filter.lat,
          lng: filter.lng,
          radius: filter.radius,
        },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'report.createdAt',
        'DESC',
      );
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });
  });

  describe('validateReport', () => {
    it('should throw a ForbiddenException if a user tries to validate their own report', async () => {
      const reportId = 'report-123';
      const profileId = 'user-123';

      const report = {
        id: reportId,
        profileId: profileId,
      } as Report;

      mockReportRepository.findOneOrFail.mockResolvedValue(report);

      await expect(
        service.validateReport(reportId, profileId, true),
      ).rejects.toThrow(
        new ForbiddenException('Users cannot validate their own reports.'),
      );
    });

    it('should validate through the 500m presence radius before saving', async () => {
      const report = {
        id: 'report-123',
        profileId: 'owner-123',
      } as Report;

      mockReportRepository.findOneOrFail.mockResolvedValue(report);
      mockReportValidationRepository.create.mockReturnValue({ id: 'v-1' });
      mockReportValidationRepository.save.mockResolvedValue({ id: 'v-1' });

      await service.validateReport(report.id, 'validator-123', true, {
        type: 'Point',
        coordinates: [-74.789, 10.987],
      });

      expect(mockReportRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        [-74.789, 10.987, 500, report.id],
      );
      expect(mockReportValidationRepository.save).toHaveBeenCalled();
    });
  });

  describe('uploadEvidence', () => {
    const reportId = 'report-123';
    const profileId = 'user-123';
    const publicImageUrl =
      'https://xyz.supabase.co/storage/v1/object/public/evidence/report-123/abc.png';

    const ownedReport = {
      id: reportId,
      profileId,
      type: ReportType.ARROYO,
      description: 'Arroyo en la via',
      location: { type: 'Point', coordinates: [-74.79, 10.99] } as Point,
      status: ReportStatus.ACTIVO,
      imageUrl: null,
      createdAt: new Date(),
    } as unknown as Report;

    it('should upload a valid JPEG image, persist the public URL and return the updated report', async () => {
      const file = createMockEvidenceFile('image/jpeg');

      mockReportRepository.findOne.mockResolvedValue(ownedReport);
      mockSupabaseStorageService.uploadReportImage.mockResolvedValue(
        publicImageUrl,
      );
      mockReportRepository.save.mockImplementation((report: Report) =>
        Promise.resolve(report),
      );

      const result = await service.uploadEvidence(reportId, profileId, file);

      expect(mockSupabaseStorageService.uploadReportImage).toHaveBeenCalledWith(
        reportId,
        file.buffer,
        'image/jpeg',
      );
      expect(mockReportRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: reportId, imageUrl: publicImageUrl }),
      );
      expect(result.imageUrl).toBe(publicImageUrl);
    });

    it('should accept every allowed image mime type', async () => {
      mockReportRepository.findOne.mockResolvedValue(ownedReport);
      mockSupabaseStorageService.uploadReportImage.mockResolvedValue(
        publicImageUrl,
      );
      mockReportRepository.save.mockImplementation((report: Report) =>
        Promise.resolve(report),
      );

      for (const mimeType of ALLOWED_EVIDENCE_MIME_TYPES) {
        const file = createMockEvidenceFile(mimeType);

        const result = await service.uploadEvidence(reportId, profileId, file);

        expect(
          mockSupabaseStorageService.uploadReportImage,
        ).toHaveBeenLastCalledWith(reportId, file.buffer, mimeType);
        expect(result.imageUrl).toBe(publicImageUrl);
      }
    });

    it('should reject a non-image file and never call the storage service', async () => {
      const file = createMockEvidenceFile('text/plain');

      mockReportRepository.findOne.mockResolvedValue(ownedReport);

      await expect(
        service.uploadEvidence(reportId, profileId, file),
      ).rejects.toThrow(
        new BadRequestException(
          `Invalid image type "${file.mimetype}". Allowed types: ${ALLOWED_EVIDENCE_MIME_TYPES.join(', ')}`,
        ),
      );
      expect(mockReportRepository.findOne).not.toHaveBeenCalled();
      expect(
        mockSupabaseStorageService.uploadReportImage,
      ).not.toHaveBeenCalled();
    });

    it('should reject when no file is provided', async () => {
      await expect(
        service.uploadEvidence(
          reportId,
          profileId,
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(
        new BadRequestException('An evidence image file is required.'),
      );
      expect(mockReportRepository.findOne).not.toHaveBeenCalled();
      expect(
        mockSupabaseStorageService.uploadReportImage,
      ).not.toHaveBeenCalled();
    });

    it('should throw a NotFoundException when the report does not exist', async () => {
      mockReportRepository.findOne.mockResolvedValue(null);

      await expect(
        service.uploadEvidence(
          reportId,
          profileId,
          createMockEvidenceFile('image/png'),
        ),
      ).rejects.toThrow(
        new NotFoundException(`Report with id "${reportId}" was not found.`),
      );
      expect(
        mockSupabaseStorageService.uploadReportImage,
      ).not.toHaveBeenCalled();
    });

    it('should throw a ForbiddenException when the report belongs to another user', async () => {
      const foreignReport = {
        ...ownedReport,
        profileId: 'another-user',
      };

      mockReportRepository.findOne.mockResolvedValue(foreignReport);

      await expect(
        service.uploadEvidence(
          reportId,
          profileId,
          createMockEvidenceFile('image/png'),
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'Users cannot upload evidence to reports they do not own.',
        ),
      );
      expect(
        mockSupabaseStorageService.uploadReportImage,
      ).not.toHaveBeenCalled();
      expect(mockReportRepository.save).not.toHaveBeenCalled();
    });
  });
});
