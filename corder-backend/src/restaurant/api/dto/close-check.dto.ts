import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PAYMENT_METHODS = [
  'cash',
  'credit-card',
  'meal-card',
  'multinet',
  'split',
  'ledger',
] as const;

export type CloseCheckMethod = (typeof PAYMENT_METHODS)[number];

export const SPLIT_PAYMENT_METHODS = [
  'cash',
  'credit-card',
  'meal-card',
  'multinet',
  'ledger',
] as const;

export type CloseCheckSplitMethod = (typeof SPLIT_PAYMENT_METHODS)[number];

export class CloseCheckDiscountDto {
  @IsIn(['percent', 'amount'])
  type!: 'percent' | 'amount';

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CloseCheckSplitDto {
  @IsIn(SPLIT_PAYMENT_METHODS)
  method!: CloseCheckSplitMethod;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CloseCheckWalkInItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CloseCheckOrderLineDto {
  @IsUUID()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CloseCheckDto {
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CloseCheckWalkInItemDto)
  items?: CloseCheckWalkInItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CloseCheckOrderLineDto)
  lines?: CloseCheckOrderLineDto[];

  @IsIn(PAYMENT_METHODS)
  method!: CloseCheckMethod;

  @IsOptional()
  @ValidateNested()
  @Type(() => CloseCheckDiscountDto)
  discount?: CloseCheckDiscountDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseCheckSplitDto)
  splitDetails?: CloseCheckSplitDto[];

  @IsOptional()
  @IsUUID()
  ledgerCustomerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ledgerDebtAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tip?: number;
}
