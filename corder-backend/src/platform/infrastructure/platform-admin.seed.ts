import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';

@Injectable()
export class PlatformAdminSeed implements OnModuleInit {
  constructor(
    @InjectRepository(PlatformAdminEntity)
    private readonly repo: Repository<PlatformAdminEntity>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const rawEmail = this.config.get<string>('PLATFORM_ADMIN_EMAIL');
    const rawPassword = this.config.get<string>('PLATFORM_ADMIN_PASSWORD');
    const email = rawEmail?.trim().toLowerCase();
    const password = rawPassword?.trim();
    if (!email || !password) return;
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) {
      const matches = await bcrypt.compare(password, existing.passwordHash);
      if (!matches) {
        existing.passwordHash = await bcrypt.hash(password, 10);
        await this.repo.save(existing);
      }
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.repo.save(
      this.repo.create({
        email,
        name: 'Platform Admin',
        passwordHash,
      }),
    );
  }
}
