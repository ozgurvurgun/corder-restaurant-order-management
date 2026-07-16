import { IsString, IsOptional, IsIn, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['mudur', 'kasiyer', 'garson'])
  role?: 'mudur' | 'kasiyer' | 'garson';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'PIN must be 4–8 digits' })
  @MaxLength(8, { message: 'PIN must be 4–8 digits' })
  @Matches(/^\d+$/, { message: 'PIN must contain only digits' })
  pin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
