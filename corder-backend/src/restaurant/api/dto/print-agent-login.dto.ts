import { IsString, MinLength } from 'class-validator';

export class PrintAgentLoginDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}
