import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';

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
      password: 'TuPasswordSeguro123', // Reemplaza por la contraseña real del usuario
    };

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(loginData)
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user).toHaveProperty('full_name', 'Juan Test E2E');
    
    // Simulamos el tiempo de sesión iniciada (2 segundos)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Procedemos al cierre de sesión
    return request(app.getHttpServer())
      .post('/auth/logout')
      .expect(200)
      .expect({ message: 'Sesión cerrada correctamente' });
  });

  afterAll(async () => {
    await app.close();
  });
});