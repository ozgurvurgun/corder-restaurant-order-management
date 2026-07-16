import { IsUUID, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsIn } from 'class-validator';
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
  total?: number;

  /**
   * `consolidated` = management panel register receipt (single printer, MANAGEMENT_RECEIPT_PRINTER).
   * `split` = terminal / category-based check (PRINT_CATEGORY_ROUTES). Default: split.
   */
  @IsOptional()
  @IsIn(['consolidated', 'split'])
  receiptMode?: 'consolidated' | 'split';
}
