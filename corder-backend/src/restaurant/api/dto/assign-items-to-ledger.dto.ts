import { ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignLedgerLineDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  /** If omitted, the entire line is assigned to the ledger. */
  quantity?: number;
}

export class AssignItemsToLedgerDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssignLedgerLineDto)
  lines: AssignLedgerLineDto[];

  @IsUUID()
  ledgerCustomerId: string;
}
