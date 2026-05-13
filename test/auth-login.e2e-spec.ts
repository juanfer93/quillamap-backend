import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigModule } from '@nestjs/config';

describe('Auth Login (e2e)', () => {
  let app: INestApplication;

  const testUser = {
    email: 'test_1778632849065@quillamap.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  };

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
    app.enableShutdownHooks();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/login', () => {
    it('should login successfully and return a JWT token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      // Check for accessToken
      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');

      // Verify the token format (simple check for three parts)
      const parts = res.body.accessToken.split('.');
      expect(parts).toHaveLength(3);

      // Check for user object
      expect(res.body.user).toBeDefined();
      expect(typeof res.body.user).toBe('object');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should fail to login with an incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });
  });
});
