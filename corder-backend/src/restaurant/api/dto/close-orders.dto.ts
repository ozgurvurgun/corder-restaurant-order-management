import { IsString } from 'class-validator';

export class CloseOrdersDto {
  @IsString()
  tableId!: string;
}
