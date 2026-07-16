import { IsString, IsOptional, IsIn, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  name: string;

  @IsIn(['mudur', 'kasiyer', 'garson'])
  role: 'mudur' | 'kasiyer' | 'garson';

  @IsOptional()
  @IsString()
  phone?: string;

  /** Numeric PIN (4–8 digits) for terminal user selection. */
  @IsString()
  @MinLength(4, { message: 'PIN must be 4–8 digits' })
  @MaxLength(8, { message: 'PIN must be 4–8 digits' })
  @Matches(/^\d+$/, { message: 'PIN must contain only digits' })
  pin: string;
}
