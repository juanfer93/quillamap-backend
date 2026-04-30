import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  });

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('QuillaMap API')
    .setDescription('API para la navegación comunitaria y legal en Barranquilla')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 9000;
  await app.listen(port);
  Logger.log(`🚀 Servidor corriendo en el puerto: ${port}`, 'Bootstrap');
}
bootstrap();
