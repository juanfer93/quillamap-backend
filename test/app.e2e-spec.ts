import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigModule } from '@nestjs/config';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test', // Use the test environment file
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('Auth flow', () => {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
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
        });
    });

    it('should fail to login with wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(400);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
