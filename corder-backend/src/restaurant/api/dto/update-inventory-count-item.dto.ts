import { IsNumber, IsUUID } from 'class-validator';

export class UpdateInventoryCountItemDto {
  @IsUUID()
  materialId!: string;

  @IsNumber()
  actual!: number;
}
