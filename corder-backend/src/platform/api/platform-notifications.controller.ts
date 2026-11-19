import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreatePlatformNotificationInput,
  PlatformNotificationsService,
} from '../application/platform-notifications.service';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';

@Controller('platform/notifications')
@UseGuards(PlatformJwtGuard)
export class PlatformNotificationsController {
  constructor(
    private readonly notificationsService: PlatformNotificationsService,
  ) {}

  @Get()
  listAll() {
    return this.notificationsService.listAll();
  }

  @Post()
  create(
    @Body() dto: CreatePlatformNotificationInput,
    @Req() req: { user?: PlatformAdminEntity },
  ) {
    return this.notificationsService.create(
      dto,
      req.user?.name || req.user?.email || 'Platform Admin',
    );
  }

  @Post(':id/send-now')
  sendNow(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.sendNow(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.remove(id);
  }
}
