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
import {
  PrinterConnection,
  PrinterStatus,
} from '../../domain/printer-config.entity';
import { PRINTER_CONNECTIONS, PRINTER_TYPES } from './create-printer.dto';

const PRINTER_STATUSES: readonly PrinterStatus[] = [
  'online',
  'offline',
  'error',
];

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(PRINTER_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(PRINTER_CONNECTIONS)
  connection?: PrinterConnection;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ipAddress?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string | null;

  @IsOptional()
  @IsIn(PRINTER_STATUSES)
  status?: PrinterStatus;

  @IsOptional()
  @IsInt()
  @Min(32)
  @Max(120)
  paperWidth?: number;

  @IsOptional()
  @IsBoolean()
  autoCut?: boolean;
}
