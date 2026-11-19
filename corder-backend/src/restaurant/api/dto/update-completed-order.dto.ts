import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_METHODS, CloseCheckMethod } from './close-check.dto';

export class CompletedOrderItemDto {
  @IsString()
  id!: string;

  @IsString()
  productId!: string;

  @IsString()
  productName!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  status!: string;

  @IsDateString()
  createdAt!: string;

  @IsOptional()
  @IsString()
  cancelReason?: string;

  @IsOptional()
  @IsString()
  cancelledBy?: string;

  @IsOptional()
  @IsDateString()
  cancelledAt?: string;
}

export class CompletedOrderDto {
  @IsString()
  id!: string;

  @IsString()
  tableId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedOrderItemDto)
  items!: CompletedOrderItemDto[];

  @IsString()
  status!: string;

  @IsDateString()
  createdAt!: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsString()
  mergedFrom?: string;
}

export class CompletedPaymentSplitDto {
  @IsString()
  method!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CompletedPaymentDiscountDto {
  @IsIn(['percent', 'amount', 'complimentary'])
  type!: 'percent' | 'amount' | 'complimentary';

  @IsNumber()
  @Min(0)
  value!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  appliedBy?: string;
}

export class CompletedPaymentDto {
  @IsString()
  id!: string;

  @IsString()
  tableId!: string;

  @IsString()
  tableName!: string;

  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(PAYMENT_METHODS)
  method!: CloseCheckMethod;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedPaymentSplitDto)
  splitDetails?: CompletedPaymentSplitDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CompletedPaymentDiscountDto)
  discount?: CompletedPaymentDiscountDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tip?: number;

  @IsString()
  processedBy!: string;

  @IsDateString()
  createdAt!: string;

  @IsOptional()
  @IsUUID()
  ledgerCustomerId?: string;

  @IsOptional()
  @IsString()
  ledgerCustomerName?: string;
}

/** Completed check adjustment - totals are recalculated on the server in minor units. */
export class UpdateCompletedOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedOrderDto)
  orders!: CompletedOrderDto[];

  @ValidateNested()
  @Type(() => CompletedPaymentDto)
  payment!: CompletedPaymentDto;
}
