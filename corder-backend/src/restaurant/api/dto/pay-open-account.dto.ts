import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class PayOpenAccountDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsIn(['cash', 'credit-card', 'meal-card', 'multinet'])
  paymentMethod?: 'cash' | 'credit-card' | 'meal-card' | 'multinet';
}
