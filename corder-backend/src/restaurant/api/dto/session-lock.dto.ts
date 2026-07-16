import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SessionLockDto {
  @IsUUID()
  staffId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  staffName?: string;
}

export class SessionUnlockDto {
  @IsUUID()
  staffId: string;
}
