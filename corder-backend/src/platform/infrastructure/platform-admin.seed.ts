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
    const email = this.config.get('PLATFORM_ADMIN_EMAIL');
    const password = this.config.get('PLATFORM_ADMIN_PASSWORD');
    if (!email || !password) return;
    const existing = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    if (existing) return;
    const passwordHash = await bcrypt.hash(password, 10);
    await this.repo.save(
      this.repo.create({
        email: email.toLowerCase(),
        name: 'Platform Admin',
        passwordHash,
      }),
    );
  }
}
