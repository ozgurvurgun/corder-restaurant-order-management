import { IsOptional, IsString } from 'class-validator';

export class PlatformLoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  authCode?: string;
}
