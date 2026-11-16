import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateRootAdminDto {
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  restaurantIds?: string[];

  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['brand_owner', 'franchise_owner', 'regional_manager'])
  bossTier?: 'brand_owner' | 'franchise_owner' | 'regional_manager';

  @IsOptional()
  @IsString()
  brandName?: string | null;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  /** Terminal login (independent of boss; stored on the restaurant). */
  @IsOptional()
  @IsEmail()
  terminalEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Terminal password must be at least 4 characters' })
  terminalPassword?: string;
}
