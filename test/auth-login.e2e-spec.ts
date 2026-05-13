import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000); 

describe('Auth Login & Logout (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    
    await app.init(); 
  });

  it('/auth/login (POST) - Debería iniciar sesión y devolver perfil + token', async () => {
    const loginData = {
      email: 'test_1778632849065@quillamap.com',
      password: 'TuPasswordSeguro123', 
    };

    const response = await (request as any)(app.getHttpServer())
      .post('/auth/login')
      .send(loginData)
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user).toHaveProperty('full_name', 'Juan Test E2E');
    
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return (request as any)(app.getHttpServer())
      .post('/auth/logout')
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toMatch(/cerrada/i);
      });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});