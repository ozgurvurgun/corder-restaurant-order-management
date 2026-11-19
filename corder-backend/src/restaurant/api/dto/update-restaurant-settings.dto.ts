import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  RESTAURANT_MENU_TEMPLATES,
  RestaurantMenuTemplate,
} from '../../../platform/domain/restaurant.entity';

export class UpdateRestaurantSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  address?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  phone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  taxId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  whatsapp?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  instagram?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  facebook?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  website?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  workingHours?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsIn(RESTAURANT_MENU_TEMPLATES)
  menuTemplate?: RestaurantMenuTemplate;

  @IsOptional()
  @IsBoolean()
  terminalLocationRestrictionEnabled?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLatitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLongitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(10000)
  locationRadiusMeters?: number;
}
