import { IsNumber, IsOptional, Min } from 'class-validator';

export class OpenShiftDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;
}
