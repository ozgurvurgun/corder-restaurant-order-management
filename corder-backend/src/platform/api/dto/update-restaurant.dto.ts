import {
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  IsEmail,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  Matches,
} from 'class-validator';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

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
  isAccessSuspended?: boolean;

  @IsOptional()
  @IsString()
  billingNotes?: string | null;

  /** Terminal login (independent of root admin). */
  @IsOptional()
  @IsEmail()
  terminalEmail?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Terminal password must be at least 4 characters' })
  terminalPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Print agent username must be at least 3 characters' })
  printAgentUsername?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Print agent password must be at least 6 characters' })
  printAgentPassword?: string;
}
