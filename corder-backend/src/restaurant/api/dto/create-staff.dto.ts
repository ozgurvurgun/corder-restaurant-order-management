import { IsString, IsOptional, IsIn, MinLength, MaxLength, Matches } from 'class-validator';
import { STAFF_ROLES, StaffRole } from '../../domain/restaurant-staff.entity';

export class CreateStaffDto {
  @IsString()
  name: string;

  @IsIn(STAFF_ROLES)
  role: StaffRole;

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
