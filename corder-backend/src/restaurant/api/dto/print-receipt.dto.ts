import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrintReceiptLineDto {
  @IsString()
  productName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  note?: string;

  /** Product ID — server attaches category UUID (print-agent category→printer). */
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

/** Table receipt: server merges via `tableId`. Walk-in sale etc.: if no `tableId`, `tableName` + `items` + `total` are required. */
export class PrintReceiptDto {
  /** Single order (check) receipt — includes notes; can also be used for completed orders. */
  @IsOptional()
  @IsUUID()
  orderId?: string;

  /** Explicit completed order ID for reprinting settled checks. */
  @IsOptional()
  @IsUUID()
  completedOrderId?: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  tableName?: string;

  @IsOptional()
  @IsString()
  waiterName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintReceiptLineDto)
  items?: PrintReceiptLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  discountLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  isReprint?: boolean;

  @IsOptional()
  @IsBoolean()
  openCashDrawer?: boolean;

  /**
   * `consolidated` = management panel register receipt (single printer, merged lines without notes).
   * `split` = itemized check receipt with notes. Default: split.
   */
  @IsOptional()
  @IsIn(['consolidated', 'split'])
  receiptMode?: 'consolidated' | 'split';
}

