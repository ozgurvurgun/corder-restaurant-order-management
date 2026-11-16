import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PrinterConnection } from '../../domain/printer-config.entity';

export const PRINTER_CONNECTIONS: readonly PrinterConnection[] = [
  'usb',
  'network',
  'bluetooth',
];

export class CreatePrinterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsIn(PRINTER_CONNECTIONS)
  connection!: PrinterConnection;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsInt()
  @Min(32)
  @Max(120)
  paperWidth?: number;

  @IsOptional()
  @IsBoolean()
  autoCut?: boolean;
}
