import { IsString, IsOptional, IsIn, MinLength, IsEmail } from 'class-validator';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  /** Terminal login (independent of root admin). */
  @IsOptional()
  @IsEmail()
  terminalEmail?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Terminal parola en az 4 karakter olmalı' })
  terminalPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(12, { message: 'Print agent token en az 12 karakter olmalı' })
  printAgentToken?: string | null;
}
