import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePlatformBillingConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  receiverName?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  iban?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  collectionStartDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  collectionEndDay?: number;

  @IsOptional()
  @IsString()
  supportPhone?: string | null;

  @IsOptional()
  @IsString()
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  paymentInstructions?: string | null;
}

export class RecordRestaurantPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  /** Explicit list of YYYY-MM periods covered by this payment (e.g. ['2026-11', '2026-12', '2027-01']). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(36)
  @IsString({ each: true })
  periods?: string[];

  /** Alternative shorthand: starting YYYY-MM period + consecutive monthsCount. */
  @IsOptional()
  @IsString()
  startPeriod?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  monthsCount?: number;

  /** Single-period shorthand ('YYYY-MM'). */
  @IsOptional()
  @IsString()
  period?: string;

  /** Actual date/time payment was received (YYYY-MM-DD or ISO string). */
  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsIn(['bank_transfer', 'cash', 'credit_card', 'other'])
  paymentMethod?: 'bank_transfer' | 'cash' | 'credit_card' | 'other';

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  reopenAccess?: boolean;
}

export class UpdateRestaurantPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(36)
  @IsString({ each: true })
  periods?: string[];

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsIn(['bank_transfer', 'cash', 'credit_card', 'other'])
  paymentMethod?: 'bank_transfer' | 'cash' | 'credit_card' | 'other';

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class SuspendRestaurantBillingDto {
  @IsOptional()
  @IsString()
  note?: string;
}
