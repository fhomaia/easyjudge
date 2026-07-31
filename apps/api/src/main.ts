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

  // Local dev nunca passa por aqui de verdade (o frontend chama /api
  // relativo, via proxy do Vite — same-origin do ponto de vista do
  // navegador). Lista fixa em vez de env var: só existe um frontend
  // real hoje, e o subdomínio padrão do Worker fica como fallback caso
  // o domínio próprio tenha algum problema.
  app.enableCors({
    origin: ['https://cheercup.com.br', 'https://cheercup-web.fhomaia.workers.dev'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
