import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigModule } from '@nestjs/config';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('Auth flow', () => {
    const testUser = {
      email: `test-${Date.now()}@quillamap.test`,
      password: 'password123',
      full_name: 'Test User',
      mobility_mode: 'carro',
      vehicle_type: 'particular',
      license_plate: 'ABC-123',
    };

    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Usuario registrado exitosamente');
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.user.email).toBe(testUser.email);
        });
    });

    it('should login the registered user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Usuario logueado exitosamente');
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.session).toBeDefined();
          expect(res.body.data.user.email).toBe(testUser.email);
          authToken = res.body.data.session.access_token;
        });
    });

    it('should fail to login with wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(400);
    });

    it('should retrieve the user profile', () => {
      return request(app.getHttpServer())
        .get('/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.full_name).toBe(testUser.full_name);
          expect(res.body.license_plate).toBe(testUser.license_plate);
        });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
