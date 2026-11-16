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
  @MinLength(4, { message: 'Terminal password must be at least 4 characters' })
  terminalPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Print agent username must be at least 3 characters' })
  printAgentUsername?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Print agent password must be at least 6 characters' })
  printAgentPassword?: string;
}
