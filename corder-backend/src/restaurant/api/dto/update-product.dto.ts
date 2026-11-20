import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  ValidateIf,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ProductIngredientInputDto } from './product-ingredient-input.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  costPrice?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductIngredientInputDto)
  ingredients?: ProductIngredientInputDto[] | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(50000)
  calories?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @IsString({ each: true })
  allergens?: string[] | null;
}
