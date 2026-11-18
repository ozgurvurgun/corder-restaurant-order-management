import { IsEmail, IsOptional, IsString } from 'class-validator';

export class PlatformLoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  authCode?: string;
}
