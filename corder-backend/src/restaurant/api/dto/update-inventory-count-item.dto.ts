import { IsNumber, IsUUID, Min } from 'class-validator';

export class UpdateInventoryCountItemDto {
  @IsUUID()
  materialId!: string;

  @IsNumber()
  @Min(0)
  actual!: number;
}
