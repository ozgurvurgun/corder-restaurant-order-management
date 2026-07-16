import {
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { Request } from 'express';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { R2UploadService } from '../infrastructure/r2-upload.service';

const uploadsDir = () => join(process.cwd(), 'uploads');

type RestaurantUser = { restaurantId: string; slug?: string };

function sanitizeTenantSegment(slug: string): string {
  const s = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (s || 'restoran').slice(0, 80);
}

function tenantPrefix(user: RestaurantUser): string {
  if (user.slug?.trim()) return sanitizeTenantSegment(user.slug);
  return user.restaurantId;
}

function buildObjectKey(tenant: string, originalName: string): string {
  const ext = extname(originalName) || '.bin';
  const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  return `${tenant}/menu/${suffix}`;
}

@Controller('restaurant/upload')
@UseGuards(RestaurantJwtGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly r2: R2UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
        if (allowed) cb(null, true);
        else cb(new BadRequestException('Only images (jpeg, png, gif, webp) allowed'), false);
      },
    }),
  )
  async upload(@Req() req: Request & { user: RestaurantUser }, @UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');

    const tenant = tenantPrefix(req.user);
    const key = buildObjectKey(tenant, file.originalname);

    if (this.r2.isConfigured()) {
      try {
        const url = await this.r2.putObject(key, file.buffer, file.mimetype);
        return { url };
      } catch (err: unknown) {
        this.logger.error('R2 upload failed', err instanceof Error ? err.stack : err);
        const e = err as { name?: string; message?: string };
        const name = e.name ?? '';
        const msg = e.message ?? '';
        if (name === 'AccessDenied' || /access denied/i.test(msg)) {
          throw new ForbiddenException(
            'R2 erisim reddedildi: API token bu bucket icin Object Read & Write olmali (corder-uploads).',
          );
        }
        if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch') {
          throw new BadRequestException('R2 anahtarlari gecersiz veya yanlis; ACCESS_KEY / SECRET kontrol edin.');
        }
        if (name === 'NoSuchBucket' || /no such bucket/i.test(msg)) {
          throw new BadRequestException('R2 bucket bulunamadi: R2_BUCKET_NAME ve hesap eslesiyor mu?');
        }
        if (process.env.UPLOAD_DEBUG === 'true') {
          throw new InternalServerErrorException(`${name}: ${msg}`);
        }
        throw new InternalServerErrorException('Dosya yuklenemedi');
      }
    }

    const dest = join(uploadsDir(), key);
    try {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, file.buffer);
    } catch (err) {
      this.logger.error('Local upload write failed', err instanceof Error ? err.stack : err);
      throw new InternalServerErrorException('Dosya diske yazilamadi');
    }
    return { url: `/uploads/${key}` };
  }
}
