import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Logos de evento/equipe (armazenamento local em disco nesta fase).
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
