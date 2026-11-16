import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class SyncRolesDto {
  @IsOptional()
  @IsUUID('4')
  sourceRestaurantId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetRestaurantIds?: string[];
}
