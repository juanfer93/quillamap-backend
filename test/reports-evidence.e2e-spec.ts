import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(60000);

const REPORT_COORDINATES = { lat: 10.987, lng: -74.789 };
const EVIDENCE_PUBLIC_URL_SEGMENT = '/storage/v1/object/public/evidence/';

interface RegisterResponseBody {
  accessToken: string;
  user: { id: string };
}

interface ReportResponseBody {
  id: string;
  imageUrl: string | null;
}

describe('Reports: Multimedia Evidence (E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let strangerToken: string;
  let reportId: string;

  const uniqueSuffix = Date.now();

  async function registerUser(label: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        full_name: `Evidence ${label}`,
        email: `evidence-${label}-${uniqueSuffix}@quillamap.test`,
        password: 'password123',
        mobility_mode: 'turista',
      })
      .expect(201);

    return (res.body as RegisterResponseBody).accessToken;
  }

  async function createOwnedReport(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'arroyo',
        description: 'Arroyo reportado para evidencia multimedia',
        location: {
          type: 'Point',
          coordinates: [REPORT_COORDINATES.lng, REPORT_COORDINATES.lat],
        },
      })
      .expect(201);

    return (res.body as ReportResponseBody).id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    ownerToken = await registerUser('owner');
    strangerToken = await registerUser('stranger');
  });

  it('Debe subir evidencia multimedia y persistir el image_url en la base de datos (PATCH /reports/:id/evidence)', async () => {
    reportId = await createOwnedReport(ownerToken);

    const uploadRes = await request(app.getHttpServer())
      .patch(`/reports/${reportId}/evidence`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('fake-png-bytes'), {
        filename: 'evidence.png',
        contentType: 'image/png',
      })
      .expect(200);

    const uploadedReport = uploadRes.body as ReportResponseBody;
    expect(uploadedReport.imageUrl).toContain(EVIDENCE_PUBLIC_URL_SEGMENT);
    expect(uploadedReport.id).toBe(reportId);

    const nearbyRes = await request(app.getHttpServer())
      .get('/reports')
      .query({ lat: REPORT_COORDINATES.lat, lng: REPORT_COORDINATES.lng })
      .expect(200);

    const nearbyReports = nearbyRes.body as ReportResponseBody[];
    const persistedReport = nearbyReports.find(
      (report) => report.id === reportId,
    );
    expect(persistedReport).toBeDefined();
    expect(persistedReport?.imageUrl).toContain(EVIDENCE_PUBLIC_URL_SEGMENT);
  });

  it('Debe rechazar con 403 la subida de evidencia a un reporte ajeno', async () => {
    await request(app.getHttpServer())
      .patch(`/reports/${reportId}/evidence`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .attach('file', Buffer.from('fake-png-bytes'), {
        filename: 'evidence.png',
        contentType: 'image/png',
      })
      .expect(403);
  });

  it('Debe rechazar con 400 un archivo que no es una imagen', async () => {
    await request(app.getHttpServer())
      .patch(`/reports/${reportId}/evidence`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('just text'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('Debe rechazar con 404 la subida a un reporte inexistente', async () => {
    await request(app.getHttpServer())
      .patch('/reports/00000000-0000-0000-0000-000000000000/evidence')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('fake-png-bytes'), {
        filename: 'evidence.png',
        contentType: 'image/png',
      })
      .expect(404);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
