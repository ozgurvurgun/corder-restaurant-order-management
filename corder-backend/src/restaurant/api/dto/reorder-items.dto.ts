import { IsArray, IsUUID } from 'class-validator';

export class ReorderItemsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}
