import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { buildCorsOptions } from './common/security/cors.config';
import { contentTypeForUploadPath } from './common/security/image-upload';
import { GlobalExceptionFilter } from './common/database/http-exception.filter';

export function resolveTrustProxySetting(raw: string | undefined): boolean | number {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'false' || normalized === '0') {
    return false;
  }
  if (normalized === 'true') {
    return true;
  }
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  return false;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.enableShutdownHooks();
  app.disable('x-powered-by');

  const trustProxy = resolveTrustProxySetting(process.env.TRUST_PROXY);
  if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  const bodyLimit = process.env.BODY_LIMIT?.trim() || '1mb';
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { extended: true, limit: bodyLimit });

  const isProd = process.env.NODE_ENV === 'production';
  app.use(
    (
      _req: unknown,
      res: { setHeader: (k: string, v: string) => void },
      next: () => void,
    ) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      if (isProd) {
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains',
        );
      }
      next();
    },
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors(buildCorsOptions());

  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
    setHeaders: (res, filePath) => {
      res.setHeader('Content-Type', contentTypeForUploadPath(filePath));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  });

  const port = Number(process.env.PORT ?? 4000);
  const server = await app.listen(port);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 60_000;
  logger.log(`Corder API listening on port ${port}`);
}

if (require.main === module) {
  bootstrap();
}
