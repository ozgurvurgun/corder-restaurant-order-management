import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class MoveOrderItemLineDto {
  @IsUUID()
  itemId!: string;

  /** Units to move. Omits = full line quantity. */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class MoveOrderItemsDto {
  @IsUUID()
  fromTableId!: string;

  @IsUUID()
  toTableId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MoveOrderItemLineDto)
  items!: MoveOrderItemLineDto[];
}
