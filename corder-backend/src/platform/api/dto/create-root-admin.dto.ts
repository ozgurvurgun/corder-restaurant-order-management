import { IsString, IsUUID, MinLength, IsEmail, IsOptional } from 'class-validator';

export class CreateRootAdminDto {
  @IsUUID()
  restaurantId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  /** Terminal login (independent of root admin; stored on the restaurant). */
  @IsOptional()
  @IsEmail()
  terminalEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Terminal password must be at least 4 characters' })
  terminalPassword?: string;
}
