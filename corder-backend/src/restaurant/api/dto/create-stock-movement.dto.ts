import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
  @MaxLength(160)
  materialName?: string;

  @IsIn(STOCK_MOVEMENT_TYPES)
  type!: StockMovementType;

  @IsNumber()
  @Min(0.0001)
  @Max(99_999_999.999)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99_999_999.99)
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999.99)
  totalCost?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  createdBy?: string;
}
