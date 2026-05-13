import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Auth Flow (Paso a Paso)', () => {
  let app: INestApplication;

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
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  // PASO 1: REGISTRO
  it('Paso 1: Debería registrar al nuevo usuario correctamente', async () => {
    const res = await (request as any)(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  // PASO 2: LOGIN (Usando los mismos datos creados arriba)
  it('Paso 2: Debería iniciar sesión con las credenciales recién creadas', async () => {
    const res = await (request as any)(app.getHttpServer())
      .post('/auth/login')
      .send({ 
        email: testUser.email, 
        password: testUser.password 
      })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.full_name).toBe(testUser.full_name);
  });

  // PASO 3: CIERRE DE SESIÓN
  it('Paso 3: Debería cerrar la sesión después de 2 segundos', async () => {
    // Tu requerimiento de esperar 2 segundos
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return (request as any)(app.getHttpServer())
      .post('/auth/logout')
      .expect(200)
      .expect({ message: 'Sesión cerrada correctamente' });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});