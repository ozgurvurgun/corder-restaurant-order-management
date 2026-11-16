import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../../platform/domain/boss-restaurant.entity';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { EffectivePolicyLimits, PERMISSION_KEYS, PermissionKey } from '../domain/permissions.catalog';
import { RolesService } from './roles.service';
import { DEFAULT_JWT_EXPIRES_IN, requireConfigSecret } from '../../common/security/env.validation';

export interface RestaurantLoginDto {
  email: string;
  password: string;
  restaurantId?: string;
}

export type RestaurantJwtRole = 'root' | 'staff' | 'terminal' | 'print_agent' | 'print_agent_refresh';

export interface RestaurantTokenPayload {
  sub: string;
  restaurantId: string;
  slug: string;
  email: string;
  name: string;
  type: 'restaurant';
  role: RestaurantJwtRole;
  staffRole?: string;
  pwdFp?: string;
}

export interface BranchSummaryDto {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  status: string;
}

export interface AuthenticatedRestaurantUserDto {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: RestaurantJwtRole;
  staffRole: string;
  roleLabel: string;
  isBoss: boolean;
  permissions: PermissionKey[];
  limits: EffectivePolicyLimits;
}

export interface LoginSessionResultDto {
  accessToken: string;
  restaurant: BranchSummaryDto;
  restaurants: BranchSummaryDto[];
  user: AuthenticatedRestaurantUserDto;
}

@Injectable()
export class RestaurantAuthService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly rolesService: RolesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async getBossOwnedRestaurants(bossId: string, fallbackRestaurantId?: string | null): Promise<RestaurantEntity[]> {
    const links = await this.bossRestaurantRepo.find({ where: { bossId }, order: { createdAt: 'ASC' } });
    const ids = new Set<string>(links.map((l) => l.restaurantId));
    if (fallbackRestaurantId) ids.add(fallbackRestaurantId);
    if (ids.size === 0) return [];
    return this.restaurantRepo.find({ where: { id: In(Array.from(ids)) }, order: { createdAt: 'ASC' } });
  }

  async assertBossOwnsRestaurant(bossId: string, restaurantId: string): Promise<RestaurantEntity> {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) throw new UnauthorizedException('Boss account is not active');
    const owned = await this.getBossOwnedRestaurants(bossId, admin.restaurantId);
    const target = owned.find((r) => r.id === restaurantId);
    if (!target) throw new ForbiddenException('You do not have access to this branch');
    return target;
  }

  async login(dto: RestaurantLoginDto): Promise<LoginSessionResultDto> {
    const email = dto.email.toLowerCase().trim();
    const bossLogin = await this.tryBossLogin(email, dto.password, dto.restaurantId);
    if (bossLogin) return bossLogin;

    const staffLogin = await this.tryStaffLogin(email, dto.password);
    if (staffLogin) return staffLogin;

    const terminalLogin = await this.tryTerminalLogin(email, dto.password);
    if (terminalLogin) return terminalLogin;

    throw new UnauthorizedException('Invalid email or password');
  }

  async loginPrintAgent(usernameInput: string, password: string) {
    const username = usernameInput.toLowerCase().trim();
    const restaurant = await this.restaurantRepo.findOne({
      where: { printAgentUsername: username },
    });
    if (
      !restaurant?.printAgentPasswordHash ||
      !(await bcrypt.compare(password, restaurant.printAgentPasswordHash))
    ) {
      throw new UnauthorizedException('Kullanıcı adı veya parola hatalı');
    }
    if (restaurant.status !== 'active') {
      throw new UnauthorizedException('İşletme hesabı aktif değil');
    }
    return this.issuePrintAgentTokens(restaurant);
  }

  async refreshPrintAgentSession(rawRefreshToken: string) {
    const jwtSecret = requireConfigSecret(this.config, 'JWT_SECRET');
    let payload: RestaurantTokenPayload;
    try {
      payload = this.jwt.verify<RestaurantTokenPayload>(rawRefreshToken.trim(), {
        secret: jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired Print Agent refresh token');
    }
    if (
      payload.type !== 'restaurant' ||
      payload.role !== 'print_agent_refresh' ||
      !payload.restaurantId ||
      !payload.email
    ) {
      throw new UnauthorizedException('Invalid Print Agent refresh token');
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: payload.restaurantId },
    });
    if (
      !restaurant ||
      restaurant.status !== 'active' ||
      !restaurant.printAgentUsername ||
      !restaurant.printAgentPasswordHash ||
      restaurant.printAgentUsername !== payload.email
    ) {
      throw new UnauthorizedException('Print Agent account is no longer active');
    }
    const expectedFp = this.computePasswordFingerprint(restaurant.printAgentPasswordHash);
    if (payload.pwdFp && payload.pwdFp !== expectedFp) {
      throw new UnauthorizedException('Print Agent password has been changed');
    }
    return this.issuePrintAgentTokens(restaurant);
  }

  private issuePrintAgentTokens(restaurant: RestaurantEntity) {
    const jwtSecret = requireConfigSecret(this.config, 'JWT_SECRET');
    const pwdFp = this.computePasswordFingerprint(restaurant.printAgentPasswordHash || '');
    const basePayload = {
      sub: restaurant.id,
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      email: restaurant.printAgentUsername!,
      name: 'Corder Print Agent',
      type: 'restaurant' as const,
      pwdFp,
    };
    const accessToken = this.jwt.sign(
      { ...basePayload, role: 'print_agent' as const },
      { secret: jwtSecret, expiresIn: '30d' },
    );
    const refreshToken = this.jwt.sign(
      { ...basePayload, role: 'print_agent_refresh' as const },
      { secret: jwtSecret, expiresIn: '3650d' },
    );
    return {
      accessToken,
      refreshToken,
      restaurant: this.toBranchSummary(restaurant),
    };
  }

  private computePasswordFingerprint(hash: string): string {
    return createHash('sha256').update(hash).digest('hex').slice(0, 16);
  }

  async getSessionProfile(user: {
    sub: string;
    restaurantId: string;
    role: RestaurantJwtRole;
  }): Promise<Omit<LoginSessionResultDto, 'accessToken'>> {
    if (user.role === 'root') return this.getBossSessionProfile(user.sub, user.restaurantId);
    if (user.role === 'staff') return this.getStaffSessionProfile(user.sub, user.restaurantId);
    return this.getTerminalSessionProfile(user.restaurantId);
  }

  async switchBranch(bossId: string, targetRestaurantId: string) {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) {
      throw new UnauthorizedException('Boss account not found');
    }
    const target = await this.assertBossOwnsRestaurant(bossId, targetRestaurantId);
    if (target.status !== 'active') {
      throw new ForbiddenException('Selected branch is not active');
    }
    const owned = await this.getBossOwnedRestaurants(bossId, admin.restaurantId);
    const activeBranches = owned.filter((r) => r.status === 'active');

    const accessToken = this.signToken({
      sub: admin.id,
      restaurantId: target.id,
      slug: target.slug,
      email: admin.email,
      name: admin.name,
      type: 'restaurant',
      role: 'root',
      staffRole: 'boss',
    });
    return {
      accessToken,
      restaurant: this.toBranchSummary(target),
      restaurants: activeBranches.map((r) => this.toBranchSummary(r)),
    };
  }

  private async tryBossLogin(
    email: string,
    password: string,
    requestedBranchId?: string,
  ): Promise<LoginSessionResultDto | null> {
    const admin = await this.rootAdminRepo.findOne({ where: { email } });
    if (!admin || admin.isActive === false) return null;
    if (!(await bcrypt.compare(password, admin.passwordHash))) return null;

    const owned = await this.getBossOwnedRestaurants(admin.id, admin.restaurantId);
    const activeBranches = owned.filter((r) => r.status === 'active');
    if (activeBranches.length === 0) {
      throw new UnauthorizedException('No active restaurant branch assigned to this Boss account');
    }
    const selected =
      (requestedBranchId && activeBranches.find((r) => r.id === requestedBranchId)) ||
      (admin.restaurantId && activeBranches.find((r) => r.id === admin.restaurantId)) ||
      activeBranches[0];

    return {
      accessToken: this.signToken({
        sub: admin.id,
        restaurantId: selected.id,
        slug: selected.slug,
        email: admin.email,
        name: admin.name,
        type: 'restaurant',
        role: 'root',
        staffRole: 'boss',
      }),
      restaurant: this.toBranchSummary(selected),
      restaurants: activeBranches.map((r) => this.toBranchSummary(r)),
      user: this.buildBossUserDto(admin),
    };
  }

  private async tryStaffLogin(email: string, password: string): Promise<LoginSessionResultDto | null> {
    const staffCandidates = await this.staffRepo.find({
      where: { email, isActive: true },
      relations: ['restaurant'],
    });
    for (const staff of staffCandidates) {
      if (!staff.passwordHash || !staff.restaurant) continue;
      if (!(await bcrypt.compare(password, staff.passwordHash))) continue;
      if (staff.restaurant.status !== 'active') {
        throw new UnauthorizedException('Branch is not active');
      }
      const resolved = await this.rolesService.resolveForStaff(staff);
      if (!resolved.canAccessPanel) {
        throw new UnauthorizedException('This account does not have permission to access the Merchant Panel');
      }
      const summary = this.toBranchSummary(staff.restaurant);
      return {
        accessToken: this.signToken({
          sub: staff.id,
          restaurantId: staff.restaurant.id,
          slug: staff.restaurant.slug,
          email: staff.email!,
          name: staff.name,
          type: 'restaurant',
          role: 'staff',
          staffRole: resolved.roleKey,
        }),
        restaurant: summary,
        restaurants: [summary],
        user: this.buildStaffUserDto(staff, resolved),
      };
    }
    return null;
  }

  private async tryTerminalLogin(email: string, password: string): Promise<LoginSessionResultDto | null> {
    const restaurant = await this.restaurantRepo.findOne({ where: { terminalEmail: email } });
    if (!restaurant?.terminalPasswordHash || !(await bcrypt.compare(password, restaurant.terminalPasswordHash))) {
      return null;
    }
    if (restaurant.status !== 'active') {
      throw new UnauthorizedException('Restaurant is not active');
    }
    const summary = this.toBranchSummary(restaurant);
    return {
      accessToken: this.signToken({
        sub: restaurant.id,
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        email: restaurant.terminalEmail!,
        name: 'Terminal',
        type: 'restaurant',
        role: 'terminal',
      }),
      restaurant: summary,
      restaurants: [summary],
      user: this.buildTerminalUserDto(restaurant),
    };
  }

  private async getBossSessionProfile(bossId: string, restaurantId: string) {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) throw new UnauthorizedException('Boss account not found');
    const owned = await this.getBossOwnedRestaurants(admin.id, admin.restaurantId);
    const activeBranches = owned.filter((r) => r.status === 'active');
    const current = activeBranches.find((r) => r.id === restaurantId) ?? activeBranches[0];
    if (!current) throw new NotFoundException('Active restaurant branch not found');
    return {
      restaurant: this.toBranchSummary(current),
      restaurants: activeBranches.map((r) => this.toBranchSummary(r)),
      user: this.buildBossUserDto(admin),
    };
  }

  private async getStaffSessionProfile(staffId: string, restaurantId: string) {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, restaurantId, isActive: true },
      relations: ['restaurant'],
    });
    if (!staff || !staff.restaurant) throw new UnauthorizedException('Staff user not found');
    const resolved = await this.rolesService.resolveForStaff(staff);
    const summary = this.toBranchSummary(staff.restaurant);
    return {
      restaurant: summary,
      restaurants: [summary],
      user: this.buildStaffUserDto(staff, resolved),
    };
  }

  private async getTerminalSessionProfile(restaurantId: string) {
    const rest = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Restaurant not found');
    const summary = this.toBranchSummary(rest);
    return { restaurant: summary, restaurants: [summary], user: this.buildTerminalUserDto(rest) };
  }

  private signToken(payload: RestaurantTokenPayload): string {
    const jwtSecret = requireConfigSecret(this.config, 'JWT_SECRET');
    const expiresIn = this.config.get('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN);
    return this.jwt.sign(payload, { secret: jwtSecret, expiresIn });
  }

  private toBranchSummary(r: RestaurantEntity): BranchSummaryDto {
    return { id: r.id, name: r.name, slug: r.slug, address: r.address ?? null, phone: r.phone ?? null, status: r.status };
  }

  private buildBossUserDto(admin: RootAdminEntity): AuthenticatedRestaurantUserDto {
    return {
      id: admin.id, email: admin.email, name: admin.name, phone: admin.phone,
      role: 'root', staffRole: 'boss', roleLabel: 'Owner (Boss)', isBoss: true,
      permissions: [...PERMISSION_KEYS], limits: { maxDiscountPercent: 100, maxDiscountAmount: null },
    };
  }

  private buildStaffUserDto(
    staff: RestaurantStaffEntity,
    resolved: { roleKey: string; roleLabel: string; permissions: PermissionKey[]; limits: EffectivePolicyLimits },
  ): AuthenticatedRestaurantUserDto {
    return {
      id: staff.id, email: staff.email ?? '', name: staff.name, phone: staff.phone,
      role: 'staff', staffRole: resolved.roleKey, roleLabel: resolved.roleLabel,
      isBoss: false, permissions: resolved.permissions, limits: resolved.limits,
    };
  }

  private buildTerminalUserDto(rest: RestaurantEntity): AuthenticatedRestaurantUserDto {
    return {
      id: rest.id, email: rest.terminalEmail ?? '', name: 'Terminal',
      role: 'terminal', staffRole: 'terminal', roleLabel: 'POS Terminal',
      isBoss: false, permissions: [], limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
    };
  }
}
