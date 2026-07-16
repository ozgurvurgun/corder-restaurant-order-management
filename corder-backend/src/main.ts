import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
      : true,
    credentials: true,
  });
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

bootstrap();
