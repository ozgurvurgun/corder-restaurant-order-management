import { IsUUID } from 'class-validator';

export class SwitchBranchDto {
  @IsUUID('4')
  restaurantId!: string;
}
