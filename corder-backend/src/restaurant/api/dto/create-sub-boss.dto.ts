import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateSubBossDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(['franchise_owner', 'regional_manager'])
  bossTier?: 'franchise_owner' | 'regional_manager';

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  restaurantIds: string[];
}

