import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export const STOCK_MOVEMENT_TYPES = [
  'in',
  'out',
  'waste',
  'count-adjustment',
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export class CreateStockMovementBodyDto {
  @IsUUID()
  materialId!: string;

  @IsOptional()
  @IsString()
  materialName?: string;

  @IsIn(STOCK_MOVEMENT_TYPES)
  type!: StockMovementType;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
