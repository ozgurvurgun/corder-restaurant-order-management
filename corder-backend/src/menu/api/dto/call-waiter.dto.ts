import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CallWaiterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  tableToken!: string;

  @IsOptional()
  @IsIn(['waiter', 'bill'])
  requestType?: 'waiter' | 'bill';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
