import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PrinterConnection } from '../../domain/printer-config.entity';

export const PRINTER_CONNECTIONS: readonly PrinterConnection[] = [
  'usb',
  'network',
  'bluetooth',
];

export const PRINTER_TYPES = ['receipt', 'kitchen', 'bar'] as const;

export class CreatePrinterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(PRINTER_TYPES)
  type!: string;

  @IsIn(PRINTER_CONNECTIONS)
  connection!: PrinterConnection;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ipAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
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
