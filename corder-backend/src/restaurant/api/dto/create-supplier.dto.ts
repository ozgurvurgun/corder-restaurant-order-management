import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(1, { message: 'Firma adi zorunludur.' })
  name: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
