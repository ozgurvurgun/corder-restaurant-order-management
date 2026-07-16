import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class R2UploadService implements OnModuleInit {
  private readonly logger = new Logger(R2UploadService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | null;
  private readonly publicBase: string | null;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    const bucket = this.config.get<string>('R2_BUCKET_NAME')?.trim();
    const publicBase = this.config.get<string>('R2_PUBLIC_BASE_URL')?.trim()?.replace(/\/$/, '');

    if (accountId && accessKeyId && secretAccessKey && bucket && publicBase) {
      // R2 is not fully compatible with SDK default checksum behavior (WHEN_SUPPORTED);
      // uploads can fail with 5xx from R2. See Cloudflare community + AWS data-integrity notes.
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      this.bucket = bucket;
      this.publicBase = publicBase;
    } else {
      this.client = null;
      this.bucket = null;
      this.publicBase = null;
    }
  }

  onModuleInit() {
    if (this.client && this.bucket) {
      this.logger.log(`R2 upload enabled (bucket=${this.bucket})`);
    } else {
      this.logger.warn(
        'R2 upload disabled: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL (docker-compose api.environment must list them). Falling back to local /uploads.',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null && this.bucket !== null && this.publicBase !== null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client || !this.bucket || !this.publicBase) {
      throw new Error('R2 is not configured');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBase}/${key}`;
  }
}
