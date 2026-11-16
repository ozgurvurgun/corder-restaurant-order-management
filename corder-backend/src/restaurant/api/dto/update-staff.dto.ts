import { IsString, IsOptional, IsIn, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';
import { STAFF_ROLES, StaffRole } from '../../domain/restaurant-staff.entity';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

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
