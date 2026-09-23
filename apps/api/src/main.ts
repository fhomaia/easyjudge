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
  //
  // Bug real corrigido (2026-09-22): `www.cheercup.com.br` serve o
  // mesmo app SEM redirecionar pro domínio raiz (decisão documentada no
  // CLAUDE.md, "Pontas soltas conscientes") — mas não estava nesta
  // lista, então qualquer usuário que caísse em `www.` (bookmark, link
  // antigo, busca) tinha TODA chamada à API bloqueada por CORS. O fetch
  // rejeita antes de virar uma resposta HTTP normal, então o frontend
  // não mostra o erro específico do backend — cai no fallback genérico
  // ("Não foi possível criar a conta.", em RegisterDialog.tsx, mas vale
  // pra qualquer chamada da API, não só cadastro). Achado investigando
  // relato de usuária real que não conseguiu se cadastrar.
  app.enableCors({
    origin: [
      'https://cheercup.com.br',
      'https://www.cheercup.com.br',
      'https://cheercup-web.fhomaia.workers.dev',
    ],
    // Sem isso o Chrome só guarda o preflight por 5s e toda chamada com
    // Authorization paga uma ida e volta extra (~350ms medido em produção).
    maxAge: 7200,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
