import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupportActionInput, SupportActionType } from '../../application/platform-support.service';

export const SUPPORT_ACTION_TYPES: readonly SupportActionType[] = [
  'clear_print_queue',
  'force_close_shift',
  'release_stuck_tables',
  'clear_notifications',
  'reset_staff_password',
  'toggle_staff_active',
];

export class ExecuteSupportActionDto implements SupportActionInput {
  @IsIn(SUPPORT_ACTION_TYPES)
  action!: SupportActionType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  newPassword?: string;
}
