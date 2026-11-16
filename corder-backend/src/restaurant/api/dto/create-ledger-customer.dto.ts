import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLedgerCustomerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddLedgerPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
