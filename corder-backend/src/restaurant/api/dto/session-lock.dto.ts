import { IsBoolean, IsOptional } from 'class-validator';

export class SessionLockDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
