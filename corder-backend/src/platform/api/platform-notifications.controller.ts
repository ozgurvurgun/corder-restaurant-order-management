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
import { PlatformNotificationsService } from '../application/platform-notifications.service';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';
import {
  BroadcastSystemUpdateDto,
  CreatePlatformNotificationDto,
} from './dto/create-platform-notification.dto';

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
    @Body() dto: CreatePlatformNotificationDto,
    @Req() req: { user?: PlatformAdminEntity },
  ) {
    return this.notificationsService.create(
      dto,
      req.user?.name || req.user?.email || 'Platform Admin',
    );
  }

  @Post('broadcast-update')
  broadcastSystemUpdate(
    @Body() dto: BroadcastSystemUpdateDto,
    @Req() req: { user?: PlatformAdminEntity },
  ) {
    return this.notificationsService.broadcastSystemUpdate(
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

