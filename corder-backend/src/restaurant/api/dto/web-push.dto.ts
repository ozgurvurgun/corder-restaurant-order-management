import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { WebPushAppType } from '../../domain/web-push-subscription.entity';

export class WebPushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  auth!: string;
}

export class WebPushSubscriptionPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WebPushKeysDto)
  keys!: WebPushKeysDto;
}

export class SubscribeWebPushDto {
  @IsOptional()
  @IsString()
  @IsIn(['terminal', 'merchant', 'boss'])
  appType?: WebPushAppType;

  @IsObject()
  @ValidateNested()
  @Type(() => WebPushSubscriptionPayloadDto)
  subscription!: WebPushSubscriptionPayloadDto;
}

export class UnsubscribeWebPushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint!: string;
}

