import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common'; 
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigModule } from '@nestjs/config';

jest.setTimeout(30000);

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  const testUser = {
    email: `test-${Date.now()}@quillamap.test`,
    password: 'password123',
    full_name: 'Test User',
    mobility_mode: 'carro',
    vehicle_type: 'particular',
    license_plate: 'ABC-123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env',
          isGlobal: true,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(new ValidationPipe());
    
    app.enableShutdownHooks();
    await app.init();
  });

  describe('Auth flow', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.mobility_mode).toBe(testUser.mobility_mode);
    });

    it('should login the registered user and get a local JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.mobility_mode).toBe(testUser.mobility_mode);
      authToken = res.body.accessToken;
    });

    it('should fail to login with wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(400);
    });

    it('should retrieve the user profile with the local JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

        expect(res.body.full_name).toBe(testUser.full_name);
        expect(res.body.mobility_mode).toBe(testUser.mobility_mode);
        expect(res.body.license_plate).toBe(testUser.license_plate);
    });
  });

  afterAll(async () => {
    // 3. Validamos que app exista antes de cerrar
    if (app) {
      await app.close();
    }
  });
});
