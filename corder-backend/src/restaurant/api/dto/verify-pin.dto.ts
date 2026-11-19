import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyPinDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'staffId must be a valid UUID',
  })
  staffId?: string;

  @IsString()
  @MinLength(4, { message: 'PIN must be 4-8 digits' })
  @MaxLength(8, { message: 'PIN must be 4-8 digits' })
  @Matches(/^\d+$/, { message: 'PIN must contain only digits' })
  pin!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;
}

