import { ArrayMinSize, IsArray, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class ReorderCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids: string[];

  /** If empty or omitted, uses the first category's parent_id (backward compatibility). */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  parentId?: string | null;
}
