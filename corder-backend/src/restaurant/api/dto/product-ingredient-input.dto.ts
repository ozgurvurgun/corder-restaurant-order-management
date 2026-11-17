import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class ProductIngredientInputDto {
  @IsUUID()
  materialId: string;

  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;
}
