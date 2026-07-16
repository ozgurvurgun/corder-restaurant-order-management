import { IsString } from 'class-validator';

export class MoveOrdersDto {
  @IsString()
  fromTableId!: string;

  @IsString()
  toTableId!: string;
}
