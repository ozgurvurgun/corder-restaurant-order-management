import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsIn(['empty', 'occupied', 'ordering', 'checkout'])
  status?: string;
}
