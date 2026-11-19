import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  PAYMENT_METHODS,
  SPLIT_PAYMENT_METHODS,
  SettlementPaymentMethod,
  SettlementSplitMethod,
} from '../../domain/services/check-settlement.policy';

export { PAYMENT_METHODS, SPLIT_PAYMENT_METHODS };
export type CloseCheckMethod = SettlementPaymentMethod;
export type CloseCheckSplitMethod = SettlementSplitMethod;

export class CloseCheckDiscountDto {
  @IsIn(['percent', 'amount', 'complimentary'])
  type!: 'percent' | 'amount' | 'complimentary';

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  appliedBy?: string;
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
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CloseCheckWalkInItemDto)
  items?: CloseCheckWalkInItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
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
  @ArrayMaxSize(50)
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
