import {
  IsIn,
  IsNotEmpty,
  IsNotIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuditCategory } from '../../domain/audit-log.entity';

const AUDIT_CATEGORIES: readonly AuditCategory[] = [
  'auth',
  'order',
  'payment',
  'product',
  'user',
  'settings',
  'stock',
  'cash-register',
  'register',
  'shift',
  'table',
];

export const SERVER_RESERVED_AUDIT_ACTIONS = [
  'completed_order_updated',
] as const;

export class CreateAuditLogBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsNotIn(SERVER_RESERVED_AUDIT_ACTIONS, {
    message: 'Server-reserved audit actions cannot be submitted by clients',
  })
  action: string;

  @IsIn(AUDIT_CATEGORIES)
  category: AuditCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  details: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export { CreateAuditLogBodyDto as CreateAuditLogDto };
