import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  closingBalance: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
