import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class TableDiscountDto {
  @IsIn(['percent', 'amount', 'complimentary'])
  type!: 'percent' | 'amount' | 'complimentary';

  @IsNumber()
  @Min(0)
  value!: number;

  @IsString()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  appliedBy?: string;
}

export class TableSplitSharePaymentDto {
  @IsInt()
  @Min(0)
  shareIndex!: number;

  @IsIn(['cash', 'credit-card', 'meal-card', 'multinet', 'ledger'])
  method!: 'cash' | 'credit-card' | 'meal-card' | 'multinet' | 'ledger';

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsUUID()
  ledgerCustomerId?: string;

  @IsString()
  paidAt!: string;
}

export class TableSplitInfoDto {
  @IsIn(['person', 'items'])
  type!: 'person' | 'items';

  @IsOptional()
  @IsInt()
  @Min(2)
  personCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perPersonAmount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TableSplitSharePaymentDto)
  paidShares?: TableSplitSharePaymentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  itemIds?: string[];

  @IsOptional()
  @IsObject()
  amounts?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  selectedTotal?: number;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  section?: string;

  @IsOptional()
  @IsIn(['empty', 'occupied', 'ordering', 'checkout', 'reserved'])
  status?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => TableDiscountDto)
  discount?: TableDiscountDto | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => TableSplitInfoDto)
  splitInfo?: TableSplitInfoDto | null;
}
