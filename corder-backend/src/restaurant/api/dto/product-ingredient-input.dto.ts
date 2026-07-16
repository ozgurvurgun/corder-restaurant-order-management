import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class ProductIngredientInputDto {
  @IsUUID()
  materialId: string;

  @IsNumber()
  @Min(0.000001)
  quantity: number;
}
