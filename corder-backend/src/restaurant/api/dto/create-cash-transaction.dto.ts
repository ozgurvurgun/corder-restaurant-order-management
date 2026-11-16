import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const MANUAL_CASH_TRANSACTION_TYPES = [
  'expense',
  'cash-in',
  'cash-out',
  'refund',
] as const;

export type ManualCashTransactionType = (typeof MANUAL_CASH_TRANSACTION_TYPES)[number];

export class CreateCashTransactionDto {
  @IsIn(MANUAL_CASH_TRANSACTION_TYPES)
  type!: ManualCashTransactionType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}

