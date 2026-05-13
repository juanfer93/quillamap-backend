import 'dotenv/config'; 
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest'; 
import { AppModule } from './../src/app.module';

jest.setTimeout(60000);

describe('Auth: Login & Logout (E2E)', () => {
  let app: INestApplication;
  let accessToken: string;

  const existingUser = {
    email: 'test-1778699484682@quillamap.test',
    password: 'password123',
    full_name: 'Test User',
    license_plate: 'ABC-123'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  describe('Flujo de Sesión', () => {
    
    it('Debe iniciar sesión correctamente y devolver el perfil completo (POST /auth/login)', async () => {
      // CORRECCIÓN: Ya no usamos (request as any), usamos la función limpia
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: existingUser.email,
          password: existingUser.password,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(existingUser.email);
      expect(res.body.user.full_name).toBe(existingUser.full_name);
      expect(res.body.user.license_plate).toBe(existingUser.license_plate);
      
      accessToken = res.body.accessToken;
    });

    it('Debe fallar el login con contraseña incorrecta (POST /auth/login)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: existingUser.email,
          password: 'password_equivocada',
        })
        .expect(400); 
    });

    it('Debe cerrar la sesión exitosamente (POST /auth/logout)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.message).toMatch(/cerrada correctamente/i);
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});