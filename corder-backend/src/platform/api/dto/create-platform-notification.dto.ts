import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreatePlatformNotificationInput } from '../../application/platform-notifications.service';
import {
  PlatformNotificationLevel,
  PlatformNotificationTargetApp,
} from '../../domain/platform-notification.entity';

export const PLATFORM_NOTIFICATION_LEVELS: readonly PlatformNotificationLevel[] = [
  'info',
  'warning',
  'urgent',
  'success',
  'system_update',
];

export const PLATFORM_NOTIFICATION_TARGET_APPS: readonly PlatformNotificationTargetApp[] = [
  'merchant',
  'boss',
  'terminal',
];

export class CreatePlatformNotificationDto implements CreatePlatformNotificationInput {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsIn(PLATFORM_NOTIFICATION_LEVELS)
  level?: PlatformNotificationLevel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(PLATFORM_NOTIFICATION_TARGET_APPS, { each: true })
  targetApps?: PlatformNotificationTargetApp[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  targetRestaurantIds?: string[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsISO8601()
  scheduledAt?: string | null;
}

export class BroadcastSystemUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  targetRestaurantIds?: string[];
}
