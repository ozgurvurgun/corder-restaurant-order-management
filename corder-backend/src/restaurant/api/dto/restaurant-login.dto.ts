import { IsString, IsEmail, MinLength } from 'class-validator';

export class RestaurantLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
