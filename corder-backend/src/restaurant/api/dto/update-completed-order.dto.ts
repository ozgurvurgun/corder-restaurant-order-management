import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CompletedOrderDto, CompletedPaymentDto } from './create-completed-order.dto';

/** Completed check correction — totals are recalculated on the server. */
export class UpdateCompletedOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedOrderDto)
  orders!: CompletedOrderDto[];

  @ValidateNested()
  @Type(() => CompletedPaymentDto)
  payment!: CompletedPaymentDto;
}
