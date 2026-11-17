import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CancelOrderItemDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** When set, cancel only this many units (must be 1..item.quantity). Omits = full line. */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
