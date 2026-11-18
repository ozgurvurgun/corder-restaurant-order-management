import {
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  IsEmail,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  slug: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  brandName?: string | null;

  @IsOptional()
  @IsIn(['independent', 'company_owned', 'franchise'])
  branchType?: 'independent' | 'company_owned' | 'franchise';

  @IsOptional()
  @IsString()
  franchiseeCompanyName?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  royaltyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'billingStartPeriod must be in YYYY-MM format',
  })
  billingStartPeriod?: string;

  @IsOptional()
  @IsBoolean()
  recordInitialPayment?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  initialPaidMonths?: number;

  @IsOptional()
  @IsIn(['bank_transfer', 'cash', 'credit_card', 'other'])
  initialPaymentMethod?: 'bank_transfer' | 'cash' | 'credit_card' | 'other';

  @IsOptional()
  @IsBoolean()
  isAccessSuspended?: boolean;

  @IsOptional()
  @IsString()
  billingNotes?: string | null;

  @IsOptional()
  @IsEmail()
  terminalEmail?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Terminal password must be at least 4 characters' })
  terminalPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  printAgentUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  printAgentPassword?: string;
}
