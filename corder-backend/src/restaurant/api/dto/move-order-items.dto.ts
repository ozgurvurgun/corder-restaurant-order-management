import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class MoveOrderItemsDto {
  @IsUUID()
  fromTableId: string;

  @IsUUID()
  toTableId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  itemIds: string[];
}
