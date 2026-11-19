import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MoveOrderItemLineDto {
  @IsUUID()
  itemId!: string;

  /** Units to move. Omits = full line quantity. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;
}

export class MoveOrderItemsDto {
  @IsUUID()
  fromTableId!: string;

  @IsUUID()
  toTableId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MoveOrderItemLineDto)
  items!: MoveOrderItemLineDto[];
}
