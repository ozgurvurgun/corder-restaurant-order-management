import { IsString, IsOptional, IsBoolean, MinLength, IsUUID, ValidateIf } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  showInTerminal?: boolean;

  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;

  @IsOptional()
  order?: number;
}
