import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FraudAlertStatus } from '../../domain/fraud-alert.entity';

export const FRAUD_ALERT_MUTATION_STATUSES: readonly FraudAlertStatus[] = [
  'open',
  'investigating',
  'resolved',
  'false_positive',
];

export class UpdateFraudAlertStatusDto {
  @IsIn(FRAUD_ALERT_MUTATION_STATUSES)
  status!: FraudAlertStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}

export class BulkDeleteFraudAlertsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  ids?: string[];

  @IsOptional()
  @IsBoolean()
  deleteAll?: boolean;

  @IsOptional()
  @IsBoolean()
  onlyResolved?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  branchId?: string;
}
