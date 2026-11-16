import { IsUUID } from 'class-validator';

export class MoveOrdersDto {
  @IsUUID()
  fromTableId!: string;

  @IsUUID()
  toTableId!: string;
}
