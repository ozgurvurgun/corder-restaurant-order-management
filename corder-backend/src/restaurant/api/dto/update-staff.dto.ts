import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'PIN must be 4–8 digits' })
  @MaxLength(8, { message: 'PIN must be 4–8 digits' })
  @Matches(/^\d+$/, { message: 'PIN must contain only digits' })
  pin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  canAccessPanel?: boolean;

  @IsOptional()
  @IsBoolean()
  canAccessTerminal?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionsOverride?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grantedPermissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  revokedPermissions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPercentOverride?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmountOverride?: number | null;
}
