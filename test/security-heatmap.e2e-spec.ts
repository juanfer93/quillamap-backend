import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Report } from '@/features/reports/entities/report.entity';
import { SECURITY_HEATMAP_MAX_NEGATIVE_VOTES } from '@/features/security/security-heatmap.constants';
import { SecurityController } from '@/features/security/security.controller';
import { SecurityHeatmapService } from '@/features/security/security-heatmap.service';

describe('Security Heatmap (E2E)', () => {
  let app: INestApplication;

  const mockReportRepository = {
    query: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [
        SecurityHeatmapService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('invisibilizes reports with 3 negative votes from the heatmap response', async () => {
    mockReportRepository.query.mockImplementation((sql: string, params: unknown[]) => {
      expect(sql).toContain(
        'having count(v.id) filter (where v."isConfirmed" = false) < $10',
      );
      expect(params[9]).toBe(SECURITY_HEATMAP_MAX_NEGATIVE_VOTES);
      return Promise.resolve([]);
    });

    const response = await request(app.getHttpServer())
      .get('/api/reports/heatmap/security')
      .query({ lat: 10.987, lng: -74.789, radius: 2000 })
      .expect(200);

    expect(response.body.points).toEqual([]);
  });
});
