import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyPinDto {
  @IsUUID('all', { message: 'staffId must be a valid UUID' })
  staffId!: string;

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

