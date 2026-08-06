import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as dns from 'node:dns';

async function bootstrap() {
  const logger = new Logger('QuillaMap_Bootstrap');

  // Workaround de desarrollo: cuando el resolver DNS del sistema esta apuntado a
  // un resolver local roto (p.ej. 127.0.0.1 sin servicio), Node no resuelve los
  // hostnames de la base de datos y lanza EAI_AGAIN. Se puede forzar una lista
  // de DNS validos de forma opt-in con la variable de entorno QM_DNS_SERVERS.
  // Ejemplo: QM_DNS_SERVERS="8.8.8.8,1.1.1.1"
  const overrideServers = process.env.QM_DNS_SERVERS;
  if (overrideServers) {
    const servers = overrideServers
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    dns.setServers(servers);
    logger.log(`Resolver DNS reconfigurado: ${dns.getServers().join(', ')}`);
  }

  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3000;
  const host = process.env.API_HOST || '0.0.0.0';
  const publicUrl = process.env.API_EXTERNAL_URL || `http://localhost:${port}/api`;

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: true,
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('QuillaMap API')
    .setDescription('API para la navegación comunitaria y legal en Barranquilla')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(publicUrl) 
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(port, host);

  logger.log('================================================');
  logger.log(`🚀 Servidor corriendo en: ${publicUrl}`);
  logger.log(`📄 Swagger UI: ${publicUrl}`);
  logger.log('================================================');
}
bootstrap();