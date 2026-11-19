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
];

export const PLATFORM_NOTIFICATION_TARGET_APPS: readonly PlatformNotificationTargetApp[] = [
  'merchant',
  'boss',
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
  @ArrayMaxSize(2)
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
