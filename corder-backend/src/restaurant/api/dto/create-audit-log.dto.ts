import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
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

export class CreateAuditLogBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  action: string;

  @IsIn(AUDIT_CATEGORIES)
  category: AuditCategory;

  @IsString()
  @IsNotEmpty()
  details: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
