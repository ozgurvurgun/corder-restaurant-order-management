import { IsString, IsUUID, IsArray, ValidateNested, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @IsUUID()
  tableId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
