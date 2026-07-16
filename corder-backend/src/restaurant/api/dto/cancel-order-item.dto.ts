import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CancelOrderItemDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
