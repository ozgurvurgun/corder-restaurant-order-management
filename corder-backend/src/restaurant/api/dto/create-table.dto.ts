import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateTableDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  section?: string;
}
