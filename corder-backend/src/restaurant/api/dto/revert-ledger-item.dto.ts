import { IsUUID } from 'class-validator';

export class RevertLedgerItemDto {
  @IsUUID()
  itemId: string;
}
