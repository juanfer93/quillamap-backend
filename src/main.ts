import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  await app.listen(9000);
}
bootstrap();
