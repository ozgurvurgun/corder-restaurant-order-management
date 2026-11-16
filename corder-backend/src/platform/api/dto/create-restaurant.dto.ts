import { IsString, IsOptional, IsIn, MinLength, IsNumber, Min, Max, IsBoolean } from 'class-validator';

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
  @IsIn(['paid', 'pending', 'overdue', 'suspended'])
  billingStatus?: 'paid' | 'pending' | 'overdue' | 'suspended';

  @IsOptional()
  @IsBoolean()
  isAccessSuspended?: boolean;

  @IsOptional()
  @IsString()
  billingNotes?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3)
  printAgentUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  printAgentPassword?: string;
}
