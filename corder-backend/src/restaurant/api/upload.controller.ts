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
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import type { Request } from 'express';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { R2UploadService } from '../infrastructure/r2-upload.service';
import {
  detectImageMimeFromMagicBytes,
  optimizeUploadedImageToWebp,
  validateOriginalImageFilename,
} from '../../common/security/image-upload';

const uploadsDir = () => resolve(process.cwd(), 'uploads');

type RestaurantUser = { restaurantId: string; slug?: string };

function sanitizeTenantSegment(slug: string): string {
  const s = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (s || 'restaurant').slice(0, 80);
}

function tenantPrefix(user: RestaurantUser): string {
  if (user.slug?.trim()) return sanitizeTenantSegment(user.slug);
  return sanitizeTenantSegment(user.restaurantId);
}

@Controller('restaurant/upload')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
@RequirePermissions(
  'catalog.manage_products',
  'catalog.manage_campaigns',
  'system.manage_settings',
)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly r2: R2UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const parsed = validateOriginalImageFilename(file.originalname);
        if (!parsed) {
          cb(
            new BadRequestException(
              'Invalid filename or extension (allowed: jpg, jpeg, png, gif, webp)',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Req() req: Request & { user: RestaurantUser },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const parsed = validateOriginalImageFilename(file.originalname);
    if (!parsed) {
      throw new BadRequestException(
        'Invalid filename or extension (allowed: jpg, jpeg, png, gif, webp)',
      );
    }

    const detectedMime = detectImageMimeFromMagicBytes(file.buffer);
    if (!detectedMime || detectedMime !== parsed.expectedMime) {
      throw new BadRequestException(
        'File content does not match extension or is not a valid image',
      );
    }

    const optimized = await optimizeUploadedImageToWebp(
      file.buffer,
      detectedMime,
      parsed.ext,
    );

    const tenant = tenantPrefix(req.user);
    const contentHash = createHash('sha256')
      .update(optimized.buffer)
      .digest('hex')
      .slice(0, 24);
    const key = `${tenant}/menu/${contentHash}${optimized.ext}`;

    if (this.r2.isConfigured()) {
      try {
        const url = await this.r2.putObject(key, optimized.buffer, optimized.mime);
        return { url };
      } catch (err: unknown) {
        this.logger.error('R2 upload failed', err instanceof Error ? err.stack : err);
        throw new InternalServerErrorException('File upload failed');
      }
    }

    const rootDir = uploadsDir();
    const dest = resolve(rootDir, key);
    if (!dest.startsWith(`${rootDir}${sep}`)) {
      throw new BadRequestException('Invalid upload destination');
    }
    try {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, optimized.buffer);
    } catch (err) {
      this.logger.error('Local upload write failed', err instanceof Error ? err.stack : err);
      throw new InternalServerErrorException('Failed to write file to disk');
    }
    return { url: `/uploads/${key}` };
  }
}
