import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateTableDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  section?: string;
}

export class BulkCreateTablesDto {
  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  startNumber?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  count: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;
}
