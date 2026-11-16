import {
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

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateRestaurantBillingStatusDto {
  @IsIn(['paid', 'pending', 'overdue', 'suspended'])
  billingStatus: 'paid' | 'pending' | 'overdue' | 'suspended';

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class SuspendRestaurantBillingDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class StartCollectionCycleDto {
  @IsOptional()
  @IsString()
  period?: string;
}
