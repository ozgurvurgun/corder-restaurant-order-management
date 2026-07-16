import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class MoveOrderItemsDto {
  @IsUUID()
  fromTableId: string;

  @IsUUID()
  toTableId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  itemIds: string[];

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Name of the person performing the action (display even if not in register/root staff). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorDisplayName?: string;
}
