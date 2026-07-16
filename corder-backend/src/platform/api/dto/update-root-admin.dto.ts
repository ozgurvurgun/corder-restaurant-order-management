import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class UpdateRootAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;

  @IsOptional()
  @IsEmail()
  terminalEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Terminal password must be at least 4 characters' })
  terminalPassword?: string;
}
