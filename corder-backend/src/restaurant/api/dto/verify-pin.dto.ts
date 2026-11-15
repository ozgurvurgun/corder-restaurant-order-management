import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyPinDto {
  @IsString()
  @MinLength(4, { message: 'PIN must be 4-8 digits' })
  @MaxLength(8, { message: 'PIN must be 4-8 digits' })
  @Matches(/^\d+$/, { message: 'PIN must contain only digits' })
  pin!: string;
}
