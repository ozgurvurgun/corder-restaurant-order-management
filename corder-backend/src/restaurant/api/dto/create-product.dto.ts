import { Type } from 'class-transformer';
import { IsString, IsUUID, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, Min, MinLength } from 'class-validator';
import { ProductIngredientInputDto } from './product-ingredient-input.dto';

export class CreateProductDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductIngredientInputDto)
  ingredients?: ProductIngredientInputDto[] | null;
}
